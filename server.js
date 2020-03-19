import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import crypto from 'crypto'
import bcrypt from 'bcrypt-nodejs'

//Setting up mongoDB database
const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost/plants'
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

const multer = require('multer')
const cloudinary = require('cloudinary')
const cloudinaryStorage = require('multer-storage-cloudinary')

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
})

const storage = cloudinaryStorage({
  cloudinary: cloudinary,
  folder: 'plant-project',
  allowedFormats: ['jpg', 'png'],
  transformation: [{ width: 500, height: 500, crop: 'limit' }]
})

const parser = multer({ storage: storage })

const port = process.env.PORT || 8000
const app = express()

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded())

const authenticateUser = async (req, res, next) => {
  const user = await User.findOne({ accessToken: req.header('Authorization') })
  if (user) {
    req.user = user
    next()
  } else {
    res.status(401).json({ loggedOut: true })
  }
}

// MODELS
const User = mongoose.model('User', {
  name: {
    type: String,
    unique: true,
    required: true,
    minlength: 3
  },
  email: {
    type: String,
    unique: true,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  }
})

const Plant = mongoose.model('Plant', {
  name: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 20
  },
  location: {
    type: String,
    required: true
  },
  acquiredAt: {
    type: Date,
    default: Date.now,
    required: false
  },
  type: {
    type: String,
    required: false
  },
  notes: {
    type: String,
    required: false,
    maxlength: 150
  },
  image: {
    type: String
  },
  waterAt: {
    type: Date,
    default: Date.now
  }
})

// Start defining your routes here
app.get('/', (req, res) => {
  res.send('Final Project - Backend by Agnes Ketesdi @Technigo 2020')
});

// Create user
app.post('/users', async (req, res) => {
  try {
    const { name, email, password } = req.body
    const user = new User({
      name,
      email,
      password: bcrypt.hashSync(password)
    })
    const saved = await user.save()
    res.status(201).json(saved)
  } catch (err) {
    res
      .status(400)
      .json({ message: 'Could not create user', errors: err.errors })
  }
});

// Login user
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (user && bcrypt.compareSync(password, user.password)) {
      res.status(201).json({
        name: user.name,
        userId: user._id,
        accessToken: user.accessToken
      })
    } else {
      res.json({ notFound: true })
    }
  } catch (err) {
    res.status(400).json({ message: 'Could not find user', errors: err.errors })
  }
});

app.get('/plants/', async (req, res) => {
  const plants = await Plant.find()
  res.status(200).json(plants)
})

// Create plant

app.post('/plants', parser.single('image'), async (req, res) => {
  try {
    const { name, location, acquiredAt, type, notes, waterAt } = req.body;
    const image = req.file.url;
    const plant = new Plant({
      name,
      location,
      acquiredAt,
      type,
      notes,
      image,
      waterAt,
    })
    const savedPlant = await plant.save()
    res.status(201).json(savedPlant)
  } catch (err) {
    res
      .status(400)
      .json({ message: 'Could not create plant', errors: err.errors })
  }
});

app.get('/secrets', authenticateUser)
app.get('/secrets', (req, res) => {
  res.json({ secret: 'This is a top secret message!' })
});

// **** PLANT PROFILE ROUTES ****

// Put route for specific plant id

app.put('/plants/:id', async (req, res) => {
  const { id } = req.params
  try {
    await Plant.findOneAndUpdate({ '_id': id }, req.body, { new: true })
    res.status(201).json(plant)
  } catch (err) {
    res.status(400).json({ message: 'Could not update plant profile', error: err.errors })
  }
});


//  Delete route for specific plant id

app.delete('/plants/:id', async (req, res) => {
  console.log(req.params)
  const { id } = req.params
  try {
    // Success to delete the plant
    await Plant.findOneAndDelete({ '_id': id })
    res.status(204).json()
  } catch (err) {
    // Failed
    res.status(404)
      .json({ message: 'Could not delete plant profile', error: err.errors })
  }
});

// Start the server

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})