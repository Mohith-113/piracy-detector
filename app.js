const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const PORT = 3000;

// Middleware to parse form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public')); // Serve static files (like index.html, style.css)

// Session setup
app.use(session({
  secret: 'piracy-detector-secret',
  resave: false,
  saveUninitialized: true
}));

// Simple in-memory user database (replace with a proper DB for production)
const users = {};

// Middleware to protect routes
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.status(401).send('Unauthorized: Please log in first.');
  }
}

// Routes

// Serve the homepage
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Register route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (users[username]) {
    return res.status(400).send('User already exists.');
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Save user credentials in memory (replace with DB in production)
  users[username] = { password: hashedPassword };
  
  res.send('User registered successfully.');
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  const user = users[username];

  if (!user) {
    return res.status(400).send('User not found.');
  }

  // Compare passwords
  const match = await bcrypt.compare(password, user.password);
  
  if (match) {
    req.session.user = username;  // Store the user session
    res.send('Login successful!');
  } else {
    res.status(400).send('Invalid credentials.');
  }
});


app.post('/search', isAuthenticated, async (req, res) => {
  const { url, keyword } = req.body;

  try {
    // Fetch the webpage content
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    
    // Extract text and search for keyword in sentences
    const text = $('body').text();
    const lowerCaseKeyword = keyword.toLowerCase(); // Convert keyword to lowercase
    const sentences = text.split('.').filter(sentence => 
      sentence.toLowerCase().includes(lowerCaseKeyword) // Case-insensitive search
    );
    
    if (sentences.length > 0) {
      // Highlight the keyword in each sentence (case-insensitive)
      const highlightedSentences = sentences.map(sentence => {
        const regex = new RegExp(`(${keyword})`, 'gi'); // Case-insensitive regex
        return sentence.replace(regex, '<mark>$1</mark>'); // Wrap keyword in <mark> tag
      });

      res.json({
        message: 'Potential piracy detected!',
        url,
        sentences: highlightedSentences // Send highlighted sentences back to the client
      });
    } else {
      res.json({
        message: 'No piracy detected.',
        url
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching the URL. Please check if the URL is valid.',
      error: error.message
    });
  }
});



// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy();  // End user session
  res.send('Logged out successfully.');
});

// Check if the user is logged in (for the frontend to manage UI state)
app.get('/check-session', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, username: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
