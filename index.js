require("./utils.js");

// loads environment variables from env to process.env while holding sensitive information
require('dotenv').config();

//used to access express and session 
const express = require('express');
const session = require('express-session');
const app = express();

app.set('view engine', 'ejs');

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
        } else {
            username = "Fellow User";
        }
        console.log("test" + username);
        
        res.render('indexUser', { username });
    } else {
        res.render("index.ejs")
    }
});

//prevents code injection 
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
       //redirects back to mainpage if validation finds something fishy
	   res.redirect("/");
	   return;
	}	

	const result = await userCollection.find({name: name}).project({name: 1, password: 1, _id: 1}).toArray();

	console.log(result);

    res.send(`<h1>Hello ${name}</h1>`);
});

//signup page
app.get('/signup', (req, res) => {
    res.render('signup');
});

//create user page
app.post('/createUser', async (req, res) => {
    var name = req.body.name;
    var email = req.body.email;
    var password = req.body.password;

    if (!req.body.name || req.body.name.trim() === '') {
        res.render('createUserInvalidName');
        return;
    }

    if (!req.body.email || req.body.email.trim() === '') {
        res.render('createUserInvalidEmail');
        return;
    }

    if (!req.body.password || req.body.password.trim() === '') {
        res.render('createUserInvalidPassword');
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
        res.render('createUserInvalid');
        return;
    }

    var hashedPassword = await bcrypt.hash(password, 12);

    await userCollection.insertOne({ name: name, password: hashedPassword, email: email });
    console.log("Inserted user into mongodb");

    req.session.authenticated = true;
    req.session.email = email;
    req.session.cookie.maxAge = expireTime;

    res.render('createUser');
});

//login page
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/loggingin', async (req, res) => {
    var email = req.body.email;
    var password = req.body.password;

    const schema = Joi.string().required();
    const validationResult = schema.validate(email);
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.render('loginInvalid');
        return;
    }

    const result = await userCollection.find({ email: email }).project({ email: 1, password: 1, _id: 1 }).toArray();

    console.log(result);
    if (result.length != 1) {
        console.log("Email not found");
        res.render('loginInvalid');
        return;
    }
    if (await bcrypt.compare(password, result[0].password)) {
        req.session.authenticated = true;
        req.session.email = email;
        req.session.cookie.maxAge = expireTime;

        res.redirect('/members');
        return;
    }
    else {
        res.render('loginInvalid');
        return;
    }
});

//members page
app.get('/members', async (req, res) => {
    const gif = Math.floor((Math.random() * 3) + 1);
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
        res.render('members', { username });
    } else {
        res.redirect("/");
    }
});

app.use(express.static(__dirname + "/public"));

//instead used function to return gif address
function gifUpload(gif, res) {
    if (gif == 1) {
        return "/pika.gif";
    }
    else if (gif == 2) {
        return "/rainbowcat.gif";
    }
    else if (gif == 3) {
        return "/surprise.gif";
    }
};

//logout page
app.get('/logout', (req,res) => {
	req.session.destroy();
    res.render('logout');
});

//redirects/catches 404 pages
app.get("*", (req, res) => {
    res.status(404);
    res.render('404');
})

//console log the port being used
app.listen(port, () => {
    console.log("Listening on port " + port);
});
