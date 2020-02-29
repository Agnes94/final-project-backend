import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import bcrypt from 'bcrypt-nodejs'
import crypto from 'crypto'


// **** MONGOOSE SETUP ****

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/plantCare"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

// **** SETUP FOR UPLOADING IMAGES ****

const multer = require("multer");
const cloudinary = require("cloudinary");
const cloudinaryStorage = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});
const storage = cloudinaryStorage({
  cloudinary: cloudinary,
  folder: "plant-project",
  allowedFormats: ["jpg", "png"],
  transformation: [{ width: 500, height: 500, crop: "limit" }]
});
const parser = multer({ storage: storage });

// **** MONGOOSE MODELS ****

//Mongoose model for User

export const User = mongoose.model('User', {
  name: {
    type: String,
    unique: true,
    required: true,
    minlength: 3,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  }
});

// Mongoose model for plant profile

export const Plant = mongoose.model('Plant', {
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
    required: true
  },
  type: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    required: true,
    maxlength: 150
  },
  image: {
    type: String,
  },
  waterAt: {
    type: Date,
    default: Date.now
  }
})

// **** MIDDLEWARES ****

// Middleware to check accesstokens

const authenticateUser = async (req, res, next) => {
  const user = await User.findOne({ accessToken: req.header('Authorization') });
  if (user) {
    req.user = user;
    next();
  } else {
    res.status(401).json({ loggedOut: true });
  }
}

// **** PORT SETUP ****
const port = process.env.PORT | 8000
const app = express()


// Add middlewares to enable cors and json body parsing
app.use(cors())

// Post route for plant profiles
app.post('/plants', parser.single("image"), (req, res) => {

  const { name, location, acquiredAt, type, notes, waterAt } = req.body
  // using mongoose model to create the database entry
  const plant = new Plant({ name, location, acquiredAt, type, notes, waterAt })
  plant.image = req.file.url
  try {
    //Success
    const savedPlant = plant.save()
    res.status(201).json(savedPlant)
  } catch (err) {
    // Failed
    res.status(400).json({ message: 'Could not create plant profile', error: err.errors })
  }
})

app.use(bodyParser.json())

// **** ROUTES ****

app.get('/', (req, res) => {
  res.send('Final Project - Backend by Agnes Ketesdi @Technigo 2020')
})

// **** USER ROUTES ****

// Register a new user

app.post("/users", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = new User({ name, email, password: bcrypt.hashSync(password) });
    await user.save();
    res.status(201).json({ id: user._id, accessToken: user.accessToken });
  } catch (err) {
    res.status(400).json({
      message: "Could not create user. Please try again!",
      errors: err.errors
    });
  }
});

// Secrets

app.get('/secrets', authenticateUser);
app.get('/secrets', (req, res) => {
  res.json({ secret: 'This is a top secret message!' });
});

// Login

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (user && bcrypt.compareSync(password, user.password)) {
      res.status(201).json({ name: user.name, userId: user._id, accessToken: user.accessToken })
    } else {
      res.json({ notFound: true })
    }
  } catch (err) {
    res.status(400).json({ message: 'Could not find user', errors: err.errors })
  }
})

// **** PLANT PROFILE ROUTES ****

// get route for specific plant id
app.get('/plants/:id', async (req, res) => {
  const plant = await Plant.findById(req.params.id)
  if (plant) {
    res.json(plant)
  } else {
    res.status(404).json({ error: 'Plant not found' })
  }
})



// Put route for specific plant id
app.put('/plants/:id', async (req, res) => {
  const { id } = req.params
  try {
    //Success
    await Plant.findOneAndUpdate({ '_id': id }, req.body, { new: true })
    res.status(201).json()
  } catch (err) {
    // Failed
    res.status(400).json({ message: 'Could not update plant profile', error: err.errors })
  }
})

// Delete route for specific plant id
app.delete('/plants/:id', async (req, res) => {
  const { id } = req.params
  try {
    // Success to delete the plant 
    await Plant.findOneAndDelete({ '_id': id })
    res.status(201).json()
  } catch (err) {
    // Failed
    res.status(404).json({ message: 'Could not delete plant profile', error: err.errors })
  }
})


// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})

app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  // render the error page
  res.status(err.status || 500);
  res.send(err);//this or res.status(err.status || 500).send('error')
});
