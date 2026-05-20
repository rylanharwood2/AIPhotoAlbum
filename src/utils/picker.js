// Google Photos Picker API
// This opens a Google-hosted picker UI in a popup window
// The user selects photos, we get back URLs and metadata
// Docs: https://developers.google.com/photos/picker/guides/get-started-picker

const PICKER_API_URL = 'https://photospicker.googleapis.com/v1'

// Opens the Google Photos Picker in a popup and waits for the user to finish
// Returns array of { url, filename, takenAt }
// Requires the user's Google access token (retrieved from our backend session)
export async function openGooglePhotosPicker(accessToken) {
  // Step 1: Create a picker session
  const sessionRes = await fetch(`${PICKER_API_URL}/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!sessionRes.ok) {
    throw new Error('Failed to create picker session — please sign in again')
  }

  const session = await sessionRes.json()
  const { id: sessionId, pickerUri } = session

  // Step 2: Open the picker URI in a popup window
  const popup = window.open(pickerUri, 'google-photos-picker', 'width=800,height=600')
  if (!popup) throw new Error('Popup blocked — please allow popups for this site')

  // Step 3: Poll until the user finishes picking (popup closes or session is set)
  await waitForPickerDone(popup, sessionId, accessToken)

  // Step 4: Fetch the selected media items
  const photos = await fetchPickerResults(sessionId, accessToken)

  return photos
}

// Poll every 2 seconds until the picker session has items or the popup closes
function waitForPickerDone(popup, sessionId, accessToken) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      // Check if popup was closed
      if (popup.closed) {
        clearInterval(interval)
        resolve() // User closed — we'll fetch whatever was selected
        return
      }

      try {
        const sessionRes = await fetch(`${PICKER_API_URL}/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const session = await sessionRes.json()

        if (session.mediaItemsSet) {
          clearInterval(interval)
          popup.close()
          resolve()
        }
      } catch {
        // Keep polling on error
      }
    }, 2000)

    // Timeout after 10 minutes
    setTimeout(() => {
      clearInterval(interval)
      popup.close()
      resolve()
    }, 10 * 60 * 1000)
  })
}

// Fetch all selected photos from the picker session
async function fetchPickerResults(sessionId, accessToken) {
  const photos = []
  let pageToken = null

  do {
    const params = new URLSearchParams({ sessionId, pageSize: '100' })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`${PICKER_API_URL}/mediaItems?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) break

    const data = await res.json()
    const items = data.mediaItems || []

    for (const item of items) {
      photos.push({
        // Request 1600px wide for good Claude analysis quality
        url: `${item.baseUrl}=w1600`,
        filename: item.filename,
        takenAt: item.mediaMetadata?.creationTime || null,
      })
    }

    pageToken = data.nextPageToken || null
  } while (pageToken)

  return photos
}
