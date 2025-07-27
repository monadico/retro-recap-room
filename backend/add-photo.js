const fs = require('fs');
const path = require('path');

// Configuration
const PHOTOS_DATA_FILE = path.join(__dirname, 'photos-data.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Helper function to read photos data
function readPhotosData() {
  try {
    const data = fs.readFileSync(PHOTOS_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading photos data:', error);
    return [];
  }
}

// Helper function to write photos data
function writePhotosData(data) {
  try {
    fs.writeFileSync(PHOTOS_DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing photos data:', error);
    return false;
  }
}

// Function to add a photo
function addPhoto(imagePath, title, description) {
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image file not found: ${imagePath}`);
    return false;
  }

  // Get file extension
  const ext = path.extname(imagePath);
  const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
  const destinationPath = path.join(UPLOADS_DIR, filename);

  try {
    // Copy the image to uploads directory
    fs.copyFileSync(imagePath, destinationPath);
    console.log(`✅ Copied image to: ${destinationPath}`);

    // Create photo object
    const newPhoto = {
      id: Date.now().toString(),
      url: `/uploads/${filename}`,
      title: title || 'Untitled Photo',
      description: description || '',
      likes: 0,
      comments: [],
      likedByUser: false,
      uploadedAt: new Date().toISOString()
    };

    // Add to photos data
    const photos = readPhotosData();
    photos.push(newPhoto);
    
    if (writePhotosData(photos)) {
      console.log(`✅ Added photo: "${newPhoto.title}"`);
      return true;
    } else {
      console.error('❌ Failed to save photo data');
      return false;
    }
  } catch (error) {
    console.error('❌ Error adding photo:', error);
    return false;
  }
}

// Example usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log(`
📸 Photo Gallery Helper Script

Usage: node add-photo.js <image-path> [title] [description]

Examples:
  node add-photo.js /path/to/photo.jpg "Team Meeting" "Great collaboration session"
  node add-photo.js /path/to/photo.jpg "Event Photo"
  node add-photo.js /path/to/photo.jpg

The script will:
1. Copy the image to the uploads directory
2. Generate a unique filename
3. Add the photo to the gallery data
4. Make it available in the web interface
    `);
    process.exit(1);
  }

  const imagePath = args[0];
  const title = args[1] || 'Untitled Photo';
  const description = args[2] || '';

  addPhoto(imagePath, title, description);
}

module.exports = { addPhoto }; 