const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'uploads')));

// Specific route for serving uploaded images
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Data file path for storing photo metadata
const PHOTOS_DATA_FILE = path.join(__dirname, 'photos-data.json');

// Initialize photos data file if it doesn't exist
if (!fs.existsSync(PHOTOS_DATA_FILE)) {
  fs.writeFileSync(PHOTOS_DATA_FILE, JSON.stringify([], null, 2));
}

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

// Routes

// GET /api/photos - Get all photos
app.get('/api/photos', (req, res) => {
  try {
    const photos = readPhotosData();
    res.json(photos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// POST /api/photos - Upload a new photo
app.post('/api/photos', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { title, description } = req.body;
    
    const newPhoto = {
      id: Date.now().toString(),
      url: `/uploads/${req.file.filename}`,
      title: title || 'Untitled Photo',
      description: description || '',
      likes: 0,
      comments: [],
      likedByUser: false,
      uploadedAt: new Date().toISOString()
    };

    const photos = readPhotosData();
    photos.push(newPhoto);
    
    if (writePhotosData(photos)) {
      res.status(201).json(newPhoto);
    } else {
      res.status(500).json({ error: 'Failed to save photo data' });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// POST /api/photos/:id/like - Toggle like on a photo
app.post('/api/photos/:id/like', (req, res) => {
  try {
    const { id } = req.params;
    const photos = readPhotosData();
    const photoIndex = photos.findIndex(p => p.id === id);
    
    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    photos[photoIndex].likes += 1;
    
    if (writePhotosData(photos)) {
      res.json(photos[photoIndex]);
    } else {
      res.status(500).json({ error: 'Failed to update photo' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to like photo' });
  }
});

// POST /api/photos/:id/comments - Add comment to a photo
app.post('/api/photos/:id/comments', (req, res) => {
  try {
    const { id } = req.params;
    const { user, text } = req.body;
    
    if (!user || !text) {
      return res.status(400).json({ error: 'User and text are required' });
    }

    const photos = readPhotosData();
    const photoIndex = photos.findIndex(p => p.id === id);
    
    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const newComment = {
      id: Date.now().toString(),
      user,
      text,
      timestamp: new Date().toISOString()
    };

    photos[photoIndex].comments.push(newComment);
    
    if (writePhotosData(photos)) {
      res.status(201).json(newComment);
    } else {
      res.status(500).json({ error: 'Failed to add comment' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// DELETE /api/photos/:id - Delete a photo
app.delete('/api/photos/:id', (req, res) => {
  try {
    const { id } = req.params;
    const photos = readPhotosData();
    const photoIndex = photos.findIndex(p => p.id === id);
    
    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = photos[photoIndex];
    
    // Delete the image file
    const imagePath = path.join(__dirname, photo.url);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Remove from data
    photos.splice(photoIndex, 1);
    
    if (writePhotosData(photos)) {
      res.json({ message: 'Photo deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Retro Recap Backend running on port ${PORT}`);
  console.log(`📸 Photo uploads will be stored in: ${path.join(__dirname, 'uploads')}`);
  console.log(`📊 Photo data stored in: ${PHOTOS_DATA_FILE}`);
}); 