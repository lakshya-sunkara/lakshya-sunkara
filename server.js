const express=require('express')
require('dotenv').config();
const cors = require("cors");
const mongoose=require('mongoose')
const bodyParser=require('body-parser')
const app = express()
const ejs=require('ejs')
const cron = require('node-cron');
const session=require('express-session')
const MongoDBStore=require('connect-mongodb-session')(session)
const User=require('./models/User')
const Style = require('./models/Style');
const UserProfile=require('./models/UserProfile')
const Appointment=require('./models/Appointment')
const bcrypt=require('bcryptjs')
const path = require('path');

const port =process.env.port || 1981
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'))
app.use(bodyParser.json())
app.set('view engine','ejs')
app.use(express.urlencoded({extended:true}))
app.use(express.json()); 
app.use(cors({
    origin: "http://127.0.0.1:5501", // Allow frontend origin
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization"
  }));
mongoose.connect(process.env.MONGO_URI, {
  
  tls: true // Enable TLS explicitly
})
  .then(() => console.log("✅ MongoDB connected successfully!"))
  .catch((error) => console.error("❌ MongoDB connection error:", error));

  const store = new MongoDBStore({
    uri: process.env.MONGO_URI,
    collection: 'mySession',
  })
  app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    store:store
  }))
  

  const checkAuth=(req,res,next)=>{
    if(req.session.isAuth){
      next()
    }else{
      res.redirect('/signin')
    }
  
  }








  app.get('/',(req,res)=>{
    res.render('main')
  })
  app.get('/signup',(req,res)=>{
    res.render('signup')
  })
  app.get('/signin',(req,res)=>{
    const error = req.session.error; // Get error from session
    req.session.error = null;
    res.render('signin', { error });
  })
  app.get('/home', checkAuth, async (req, res) => {
  try {
    const allStyles = await Style.find();

    // Categorize styles
    const grouped = {
      Hair: [],
      Beard: [],
      Facial: [],
      "Child Hair Cut": [],
      Massage: []
    };

    allStyles.forEach(style => {
      if (grouped[style.category]) {
        grouped[style.category].push(style);
      }
    });

    res.render('home', {
      styles: grouped["Hair"],
      beardStyles: grouped["Beard"],
      facialStyles: grouped["Facial"],
      childHaircutStyles: grouped["Child Hair Cut"],
      massageStyles: grouped["Massage"]
    });
  } catch (err) {
    console.error("Error fetching styles:", err);
    res.status(500).send("Error loading styles");
  }
});

  app.get('/signout',(req,res)=>{
    res.render('signout')
  })
app.get('/services', async (req, res) => {
  try {
    const allStyles = await Style.find();

    // Categorize styles
    const grouped = {
      Hair: [],
      Beard: [],
      Facial: [],
      "Child Hair Cut": [],
      Massage: []
    };

    allStyles.forEach(style => {
      if (grouped[style.category]) {
        grouped[style.category].push(style);
      }
    });

    res.render('services', {
      styles: grouped["Hair"],
      beardStyles: grouped["Beard"],
      facialStyles: grouped["Facial"],
      childHaircutStyles: grouped["Child Hair Cut"],
      massageStyles: grouped["Massage"]
    });
  } catch (err) {
    console.error("Error fetching styles for services page:", err);
    res.status(500).send("Error loading services");
  }
});


 app.get('/about_us',checkAuth,(req,res)=>{
  res.render('about_us')
 })
 app.get('/appointment',checkAuth,(req,res)=>{
  res.render('appointment')
 })

app.get('/book-appointment', (req, res) => {
  const { image, name, category } = req.query;
  res.render('book-appointment', { image, name, category });
});


 app.get('/profile_details',checkAuth,(req,res)=>{
  res.render('user_details')
 })
 app.get('/updateApp',checkAuth,(req,res)=>{
  res.render('updateAppointmentDetails')
 })
app.get('/style/:id', async (req, res) => {
  const id = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send('Invalid ID');
  }

  const style = await Style.findById(id);
  if (!style) return res.status(404).send('Style not found');

  res.render('style-details', { style });
});

app.get("/admin/styles", (req, res) => {
  res.render("styles", {
    message: null,
    messageColor: null
  });
});





  app.post('/register',async(req,res)=>{
      const {email,password,username}=req.body
      let user=await User.findOne({email})
      if(user){
        return res.redirect('/signin')
      }
      const hashedPassword=await bcrypt.hash(password,12); 
      user=new User({username,email,password:hashedPassword})
      req.session.person=user.username
      await user.save()
      req.session.isAuth=true
      req.session.email=user.email
      res.redirect('/profile_details')
  })
  app.post('/login-user',async(req,res)=>{
    const {email,password}=req.body;
    const user=await User.findOne({email});
    if(!user){
      req.session.error = "Invalid email! please try again."; // Store error in session
        return res.redirect('/signin');
    }
    const checkPassword=await bcrypt.compare(password,user.password);
    if(!checkPassword){
      req.session.error = "incorrect password! please try again.";
        return res.redirect('/signin');
    }
    req.session.isAuth=true
    req.session.email=user.email
    res.redirect('/home')
  })

  app.post('/user-profile',async (req,res)=>{
    const {email,name,phone,address,gender,dob}=req.body
    const user=await User.findOne({email});
    if(!user){
      return res.render('signup')
    }
    const username=user.username
    const userProfile=new UserProfile({username,email,name,phone,address,gender,dob})
    await userProfile.save()
    res.redirect('/home')
  })

  app.get("/user/profile", async (req, res) => {
    if (!req.session.email) {
        return res.status(401).json({ message: "Not logged in" });
    }

    const user = await UserProfile.findOne({ email: req.session.email });
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
});


app.post('/appointment', async (req, res) => {
  try {
      const { category, style, appointment_date, time_slot } = req.body;
      const email = req.session.email; // Get email directly from session

      if (!email) {
          return res.status(401).json({ message: "Unauthorized: Please log in." });
      }

      // Convert date to ensure correct format
      const formattedDate = new Date(appointment_date);
      
      // Check if an appointment already exists for this user at the same date & time slot
      const existingAppointment = await Appointment.findOne({ email, appointment_date: formattedDate, time_slot });

      if (existingAppointment) {
          return res.status(400).json({ message: "You already have an appointment at this time slot!" });
      }

      // Save new appointment
      const appointment = new Appointment({ email, category, style, appointment_date: formattedDate, time_slot });
      await appointment.save();

      res.redirect('/appointment');
  } catch (error) {
      if (error.code === 11000) {
          return res.status(400).json({ message: "You already have an appointment at this time slot!" });
      }
      console.error("Error booking appointment:", error);
      res.status(500).json({ message: "Internal server error" });
  }
});
app.post("/add-style", async (req, res) => {
  const { styleId, name, category, price, image } = req.body;

  try {
    const existing = await Style.findOne({ styleId });
    if (existing) {
      return res.render("styles", {
        message: "❌ Style ID already exists.",
        messageColor: "red"
      });
    }

    const newStyle = new Style({ styleId, name, category, price, image });
    await newStyle.save();

    return res.render("styles", {
      message: "✅ Style added successfully!",
      messageColor: "green"
    });
  } catch (err) {
    console.error("Error adding style:", err);
    return res.status(500).render("styles", {
      message: "❌ Internal server error.",
      messageColor: "red"
    });
  }
});




app.get('/appointments', async (req, res) => {
  try {
      const email = req.session.email; // Get logged-in user's email

      if (!email) {
          return res.status(401).json({ message: "Unauthorized: Please log in." });
      }

      const appointments = await Appointment.find({ email }).sort({ appointment_date: 1, time_slot: 1 });
      res.json(appointments);
  } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "Internal server error" });
  }
});



app.delete('/appointment/:id', async (req, res) => {
  try {
      const deletedAppointment = await Appointment.findByIdAndDelete(req.params.id);
      if (!deletedAppointment) {
          return res.status(404).json({ message: "Appointment not found" });
      }

      res.json({ message: "Appointment deleted successfully" });
  } catch (error) {
      res.status(500).json({ message: "Error deleting appointment" });
  }
});


// ✅ Update an appointment
// Route to update an appointment
app.get('/update/:id',  async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send("Invalid appointment ID");
  }
      const appointment = await Appointment.findById(id);
      if (!appointment) {
          return res.status(404).json({ message: "Appointment not found" });
      }
      
      res.json(appointment);  // Send appointment details as JSON
      
  } catch (error) {
      console.error("Error fetching appointment:", error);
      res.status(500).json({ message: "Server error" });
  }
});


app.put('/update/:id',  async (req, res) => {
  try {
      const { category, style, appointment_date, time_slot } = req.body;

      const updatedAppointment = await Appointment.findByIdAndUpdate(
          req.params.id,
          { category, style, appointment_date, time_slot },
          { new: true }
      );

      if (!updatedAppointment) {
          return res.status(404).json({ message: "Appointment not found" });
      }

      res.json({ message: "Appointment updated successfully!", updatedAppointment });
  } catch (error) {
      console.error("Error updating appointment:", error);
      res.status(500).json({ message: "Server error" });
  }
});






  app.post('/log-out',(req,res)=>{
    req.session.destroy((err)=>{
      if(err) throw err
      res.redirect('/signout')
    })
  })

app.listen(port,()=>{
    console.log(`server is running on port ${port}`)
})
