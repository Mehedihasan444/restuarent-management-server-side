const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;


// middleware
app.use(cors(
    {
        origin: [
            'http://localhost:5173'
        ],
        credentials: true
    }
))
app.use(express.json());
app.use(cookieParser());

//mongodb connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.drfmhtt.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



// custom made middlewares

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;

    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    jwt.verify(token, process.env.Access_Token_Secret, (error, decoded) => {
        if (error) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        res.user = decoded;
        next();
    })
}


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userCollection = client.db('restaurantManagementDB').collection('Users')
        const foodCollection = client.db('restaurantManagementDB').collection('Foods')

        // getting all foods
        app.get('/api/v1/foods', async (req, res) => {
            const result = await foodCollection.find().toArray();
            res.send(result)
        })
        // getting all foods
        app.get('/api/v1/foods/:foodId', async (req, res) => {
            const id = req.params.foodId;
            const query = { _id: new ObjectId(id) }
            // const options =  {
            //     projection: {title:1,price:1,image:1}
            // }
            const result = await foodCollection.findOne(query);
            res.send(result)
        })


        // auth related api
        app.post('/api/v1/auth/access-token', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.Access_Token_Secret, { expiresIn: '1h' });

            res.cookie('token', token, {
                httpOnly: true,
                secure: false,
                sameSite: 'none'
            }).send({ success: true })
        })


        // add a food 
        app.post('/api/v1/user/add-food', async (req, res) => {
            const food = req.body;
            const result = await foodCollection.insertOne(food)
            res.send(result)
        })

        // delete a food
        app.delete('/api/v1/user/delete-food/:foodId', async (req, res) => {
            const id = req.params.foodId;
            const query = { _id: new ObjectId(id) }
            const result = await foodCollection.deleteOne(query);
            res.send(result)
        })

        // update a food
        app.put('/api/v1/user/update-food/:foodId', async (req, res) => {
            const id = req.params.foodId;
            const updatedFood = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true }
            const updateDoc = {
                $set: {

                },

            };
            const result = await foodCollection.updateOne(filter, updateDoc, options)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



// respond with "hello world" when a get request is made to the homepage
app.get('/', (req, res) => {
    res.send('Restaurant is running')
})

app.listen(port, () => {
    console.log(`server is running on port: ${port}`);
})