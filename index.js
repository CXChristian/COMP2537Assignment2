require("./utils.js");

// loads environment variables from env to process.env while holding sensitive information
require('dotenv').config();

//used to access express and session 
const express = require('express');
const session = require('express-session');
const app = express();

const MongoStore = require('connect-mongo');

//used to connect to mongodb
const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');
app.use(express.urlencoded({ extended: false }));
var { database } = include('databaseConnection');
const userCollection = database.db('sessions').collection('users');

const Joi = require("joi");

//the port that is used to run the local host
const port = process.env.PORT || 3080;

//session ends after one hour (hours * minutes * seconds * millis)
const expireTime = 1 * 60 * 60 * 1000

//connecting to mongodb, tutorial code from mongodb site
async function mongodbConnect() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    //connects to mongodb or catches error
    try {
        await client.connect();
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

mongodbConnect().catch(console.error);

//encrypts and stores session in mongodb
var mongoStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    crypto: {
        secret: process.env.MONGODB_SESSION_SECRET
    }
})

//creates a session based
app.use(session({
    secret: process.env.NODE_SESSION_SECRET,
    store: mongoStore,
    saveUninitialized: false,
    resave: true
}))

//main page
app.get('/', async (req, res) => {
    var html = `Conrad's COMP 2537 Web Dev Assignment 1<br>`;
    if (req.session.authenticated) {
        const email = req.session.email;

        const schema = Joi.string().max(20).required();
        const validationResult = schema.validate(email);
        if (validationResult.error != null) {
           console.log(validationResult.error);
           res.redirect("/");
           return;
        }

        const result = await userCollection.find({ email: email}).project({ name: 1, _id: 0}).toArray();
        let username = "";
        if (result.length > 0) {
            username = result[0].name;
        }
        console.log("test " + username);
        html += `
        Hello, ${username}
        <div><a href ="/members">Go to Members Area</a></div>
        <div><a href ="/logout">Logout</a></div>
        `;
        res.send(html);
    } else {
        html += `
        <div><a href ="/signup">Sign Up</a></div>
        <div><a href ="/login">Log In</a></div>
        `;
        res.send(html);
    }
});

app.get('/nosql-injection', async (req,res) => {
	var name = req.query.user;

	if (!name) {
		res.send(`<h3>no user provided - try /nosql-injection?user=name</h3> <h3>or /nosql-injection?user[$ne]=name</h3>`);
		return;
	}
	console.log("user: "+name);

	const schema = Joi.string().max(20).required();
	const validationResult = schema.validate(name);

	if (validationResult.error != null) {  
	   console.log(validationResult.error);
	   res.send("<h1 style='color:darkred;'>A NoSQL injection attack was detected!!</h1>");
	   return;
	}	

	const result = await userCollection.find({name: name}).project({name: 1, password: 1, _id: 1}).toArray();

	console.log(result);

    res.send(`<h1>Hello ${name}</h1>`);
});

//signup page
app.get('/signup', (req, res) => {
    var html = `
    <div>create user</div>
    <form action='/createUser' method='post'>
    <input name='name' type='text' placeholder='name'>
    <input name='email' type='text' placeholder='email'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

//create user page
app.post('/createUser', async (req, res) => {
    var name = req.body.name;
    var email = req.body.email;
    var password = req.body.password;

    if (!req.body.name || req.body.name.trim() === '') {
        res.redirect("/createUserInvalidName");
        return;
    }

    if (!req.body.email || req.body.email.trim() === '') {
        res.redirect("/createUserInvalidEmail");
        return;
    }

    if (!req.body.password || req.body.password.trim() === '') {
        res.redirect("/createUserInvalidPassword");
        return;
    }

    console.log(name);

    const schema = Joi.object(
        {
            name: Joi.string().alphanum().max(20).required(),
            email: Joi.string().max(20).required(),
            password: Joi.string().max(20).required()
        });

    const validationResultName = schema.validate({ name, password, email });
    if (validationResultName.error != null) {
        console.log(validationResultName.error);
        res.redirect("/createUserInvalid");
        return;
    }

    var hashedPassword = await bcrypt.hash(password, 12);

    await userCollection.insertOne({ name: name, password: hashedPassword, email: email });
    console.log("Inserted user into mongodb");

    var html = `successfully created user
    
    <div><a href ="/">Homepage</a></div>
    `;

    req.session.authenticated = true;
    req.session.email = email;
    req.session.cookie.maxAge = expireTime;

    res.send(html);
});

app.get('/createUserInvalid', (req, res) => {
    var html = `
        signin requirements not met

        <div><a href ="/signup">Try again</a></div>
    `;
    res.send(html);
})

app.get('/createUserInvalidName', (req, res) => {
    var html = `
        Please provide a name.

        <div><a href ="/signup">Try again</a></div>
    `;
    res.send(html);
})

app.get('/createUserInvalidEmail', (req, res) => {
    var html = `
        Please provide an email address.

        <div><a href ="/signup">Try again</a></div>
    `;
    res.send(html);
})

app.get('/createUserInvalidPassword', (req, res) => {
    var html = `
        Please provide a password.

        <div><a href ="/signup">Try again</a></div>
    `;
    res.send(html);
})

//login page
app.get('/login', (req, res) => {
    var html = `
    log in
    <form action='/loggingin' method='post'>
    <input name='email' type='text' placeholder='email'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.post('/loggingin', async (req, res) => {
    var email = req.body.email;
    var password = req.body.password;

    const schema = Joi.string().required();
    const validationResult = schema.validate(email);
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.redirect("/login");
        return;
    }

    const result = await userCollection.find({ email: email }).project({ email: 1, password: 1, _id: 1 }).toArray();

    console.log(result);
    if (result.length != 1) {
        console.log("email not found");
        res.redirect("/login");
        return;
    }
    if (await bcrypt.compare(password, result[0].password)) {
        console.log("correct password");
        req.session.authenticated = true;
        req.session.email = email;
        req.session.cookie.maxAge = expireTime;

        res.redirect('/members');
        return;
    }
    else {
        console.log("Invalid email/password combination");
        res.redirect("/login");
        return;
    }
});

//members page
app.get('/members', async (req, res) => {
    const gif = Math.floor((Math.random() * 3) + 1);
    var html = `Conrad's COMP 2537 Web Dev Assignment 1<br>`;
    if (req.session.authenticated) {
        const email = req.session.email;

        const schema = Joi.string().max(20).required();
        const validationResult = schema.validate(email);
        if (validationResult.error != null) {
           console.log(validationResult.error);
           res.redirect("/");
           return;
        }

        const result = await userCollection.find({ email: email}).project({ name: 1, _id: 0}).toArray();
        let username = "";
        if (result.length > 0) {
            username = result[0].name;
        }
        console.log("test " + username);
        html += `
        Hello, ${username}
        <img src= "/gif/2"/>
        <div><a href ="/logout">Logout</a></div>
        `;
        res.send(html);
    } else {
        res.redirect("/");
    }
});

app.get('/gif/:id', (req,res) => {

    var gif = req.params.id;

    if (gif == 1) {
        res.send("<img src='/pika.gif' style='width:250px;'>");
    }
    else if (gif == 2) {
        res.send("<img src='/rainbowcat.gif' style='width:250px;'>");
    }
    else if (gif == 3) {
        res.send("<img src='/surprise.gif' style='width:250px;'>");
    }
    else {
        res.send("Invalid gif id: "+gif);
    }
});

app.use(express.static(__dirname + "/public"));

//logout page
app.get('/logout', (req,res) => {
	req.session.destroy();
    var html = `
    You are logged out.
    <div><a href ="/">Homepage</a></div>
    `;
    res.send(html);
});

//redirects/catches 404 pages
app.get("*", (req, res) => {
    res.status(404);
    res.send("Sorry! We could not find that page. Error 404");
})

//console log the port being used
app.listen(port, () => {
    console.log("Listening on port " + port);
});
