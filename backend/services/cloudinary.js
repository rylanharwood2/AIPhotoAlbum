const cloudinary = require('cloudinary').v2

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Upload a file buffer to Cloudinary under a trip folder
// Returns { url, public_id }
async function uploadPhoto(buffer, filename, tripId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `triproll/${tripId}`,
        public_id: filename.replace(/\.[^.]+$/, ''), // strip extension
        resource_type: 'image',
        // Keep original quality — we want Claude to see good images
        quality: 'auto:best',
      },
      (error, result) => {
        if (error) return reject(error)
        resolve({ url: result.secure_url, publicId: result.public_id })
      }
    )
    uploadStream.end(buffer)
  })
}

// Upload from a remote URL (for Google Photos Picker images)
async function uploadFromUrl(remoteUrl, filename, tripId) {
  const result = await cloudinary.uploader.upload(remoteUrl, {
    folder: `triproll/${tripId}`,
    public_id: filename.replace(/\.[^.]+$/, ''),
    resource_type: 'image',
    quality: 'auto:best',
  })
  return { url: result.secure_url, publicId: result.public_id }
}

// Delete all photos for a trip
async function deleteTripPhotos(tripId) {
  await cloudinary.api.delete_resources_by_prefix(`triproll/${tripId}`)
  await cloudinary.api.delete_folder(`triproll/${tripId}`)
}

module.exports = { uploadPhoto, uploadFromUrl, deleteTripPhotos }
