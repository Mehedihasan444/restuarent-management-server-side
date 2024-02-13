const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const SSLCommerzPayment = require("sslcommerz-lts");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      // "https://65c937eda4e7cf5f6756c714--comfy-kataifi-8435e8.netlify.app"
    ],
    credentials: true,
  })
);
// "https://65c933bae29cb75f8186ac1d--comfy-kataifi-8435e8.netlify.app",
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
  },
});

const store_id = process.env.storeID;
const store_passwd = process.env.storePasswd;
const is_live = false; //true for live, false for sandbox

// custom made middlewares

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  // console.log(token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.Access_Token_Secret, (error, decoded) => {
    if (error) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client
      .db("restaurantManagementDB")
      .collection("Users");
    const foodCollection = client
      .db("restaurantManagementDB")
      .collection("Foods");
    const sliderCollection = client
      .db("restaurantManagementDB")
      .collection("HomeBannerSlider");
    const orderCollection = client
      .db("restaurantManagementDB")
      .collection("Orders");
    const cartCollection = client
      .db("restaurantManagementDB")
      .collection("cartItems");

    // user related api
    app.post("/api/v1/users", async (req, res) => {
      try {
        const data = req.body;
        const query = { email: data.email };

        // Check if the user already exists
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.status(400).json({ error: "User already exists" });
        }

        // Insert the new user
        const result = await userCollection.insertOne(data);
        res
          .status(201)
          .json({ message: "User created successfully", user: result.ops[0] });
      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.get("/api/v1/user/role/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // getting all home banner slider data
    app.get("/api/v1/home-banner-slider", async (req, res) => {
      const result = await sliderCollection.find().toArray();
      res.send(result);
    });

    // getting all foods
    // pagination
    // filtering
    // food count
    // searching

    app.get("/api/v1/foods", async (req, res) => {
      let queryObj = {};
      let sortObj = {};
      const category = req.query.category;
      const sortField = req.query.sortField;
      const sortOrder = req.query.sortOrder;
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const skip = (page - 1) * limit;
      const foodName = req.query.foodName;
      // console.log(category,sortField,sortOrder,page,limit,skip);
      if (category) {
        queryObj.foodCategory = category;
      }
      if (sortField && sortOrder) {
        sortObj[sortField] = sortOrder;
      }
      if (foodName) {
        const searchTerm = new RegExp(foodName, "i"); // 'i' for case-insensitive search
        queryObj.foodName = searchTerm;
      }
      const result = await foodCollection
        .find(queryObj)
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .toArray();
      const count = await foodCollection.estimatedDocumentCount();
      // console.log({ result, count });
      res.send({ result, count });
    });
    //update quantity
    app.put("/api/v1/foods/:foodId", async (req, res) => {
      const id = req.params.foodId;
      const updatedFood = req.body;
      console.log(updatedFood);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          quantity: updatedFood.quantity,
          sellCount: updatedFood.sellCount,
        },
      };
      const result = await foodCollection.updateOne(filter, updateDoc, options);
      // console.log(result);
      res.send(result);
    });

    // get orders
    app.get("/api/v1/customer-orders", async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    app.get(
      "/api/v1/user/food-orders/:userEmail",
      verifyToken,
      async (req, res) => {
        const userEmail = req.params.userEmail;
        if (req.user.email.toLowerCase() !== userEmail) {
          return res.status(403).send({ message: "forbidden access" });
        }
        let query = {};
        if (userEmail) {
          // query = { email: req.query.email }
          query = { userEmail: userEmail };
        }
        const result = await orderCollection.find(query).toArray();
        res.send(result);
      }
    );

    // get add foods
    app.get("/api/v1/user/added-foods", async (req, res) => {
      let userEmailObj = {};
      let foodIdObj = {};
      const userEmail = req.query.userEmail;
      const foodId = req.query.foodId;
      if (!userEmail) {
        return res.status(400).send("User email is required.");
      }
      if (userEmail) {
        userEmailObj.userEmail = userEmail;
      }
      if (foodId) {
        foodIdObj._id = new ObjectId(foodId);
        foodIdObj.userEmail = userEmail;
      }
      // const query = { userEmail: userEmail }

      const SingleResult = await foodCollection.findOne(foodIdObj);
      const result = await foodCollection.find(userEmailObj).toArray();
      res.send({ result, SingleResult });
    });

    // getting all foods
    app.get("/api/v1/foodDetails/:foodId", async (req, res) => {
      const id = req.params.foodId;
      const query = { _id: new ObjectId(id) };
      // const options =  {
      //     projection: {title:1,price:1,image:1}
      // }
      const result = await foodCollection.findOne(query);
      res.send(result);
    });

    // auth related api
    app.post("/api/v1/auth/access-token", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.Access_Token_Secret, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });
    app.post("/logOut", async (req, res) => {
      const user = req.body;
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // add a food
    app.post("/api/v1/user/add-food", async (req, res) => {
      const food = req.body;
      const result = await foodCollection.insertOne(food);
      res.send(result);
    });

    // top selling food api
    app.get("/api/v1/foods/desc", async (req, res) => {
      const result = await foodCollection
        .find()
        .sort({ sellCount: "desc" })
        .toArray();
      res.send(result);
    });

    const tran_id = new ObjectId().toString();

    app.post("/api/v1/user/food/payment/:id", async (req, res) => {
      const orderId = req.params.id;
      const query = {
        _id: new ObjectId(orderId),
      };
      const order = await orderCollection.findOne(query);

      const data = {
        total_amount: order.price,
        currency: "USD",
        tran_id: tran_id,
        success_url: `http://localhost:5000/api/v1/user/payment/success/${tran_id}?orderId=${order._id}`,
        fail_url: `http://localhost:5000/api/v1/user/payment/fail/${tran_id}?orderId=${order._id}`,
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: order.foodName,
        product_category: order.foodCategory,
        product_profile: "general",
        cus_name: order.userName,
        cus_email: order.userEmail,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: order.userName,
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });
        console.log("Redirecting to: ", GatewayPageURL);
      });

      app.post("/api/v1/user/payment/success/:tranId", async (req, res) => {
        const result = await orderCollection.updateOne(
          { _id: new ObjectId(req.query.orderId) },
          {
            $set: {
              payment: "complete",
              transactionId: req.params.tranId,
            },
          }
        );
        if (result.modifiedCount > 0) {
          res.redirect(
            `http://localhost:5173/api/v1/payment-complete/${req.params.tranId}`
          );
        }
      });
      app.post("/api/v1/user/payment/fail/:tranId", async (req, res) => {
        const result = await orderCollection.updateOne(
          { _id: new ObjectId(req.query.orderId) },
          {
            $set: {
              payment: "failed",
              // transactionId: req.params.tranId
            },
          }
        );
        if (result.modifiedCount > 0) {
          res.redirect(
            `http://localhost:5173/api/v1/payment-failed/${req.params.tranId}`
          );
        }
      });
    });
    // working
    app.post("/api/v1/user/foods/payment", async (req, res) => {
      const id = new ObjectId().toString();
      const cartItem = req.body;
      const info = {
        ...cartItem,
        code: id,
      };
      const result = await orderCollection.insertOne(info);

      const data = {
        total_amount: cartItem.totalBill,
        currency: "USD",
        tran_id: tran_id,
        success_url: `http://localhost:5000/api/v1/user/payment/success/${tran_id}?code=${id}`,
        fail_url: `http://localhost:5000/api/v1/user/payment/fail/${tran_id}?code=${id}`,
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "combine food",
        product_category: "Mix category",
        product_profile: "general",
        cus_name: cartItem.userName,
        cus_email: cartItem.userEmail,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: cartItem.userName,
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });
        console.log("Redirecting to: ", GatewayPageURL);
      });

      app.post("/api/v1/user/payment/success/:tranId", async (req, res) => {
        const result = await orderCollection.updateOne(
          { code: req.query.code },
          {
            $set: {
              payment: "complete",
              transactionId: req.params.tranId,
            },
          }
        );
        if (result.modifiedCount > 0) {
          res.redirect(
            `http://localhost:5173/api/v1/payment-complete/${req.params.tranId}`
          );
        }

        const cart = await cartCollection.find().toArray();
        const ids = cart.map((x) => x._id);
        const query = { _id: { $in: ids } };
        await cartCollection.deleteMany(query);
      });
      app.post("/api/v1/user/payment/fail/:tranId", async (req, res) => {
        const result = await orderCollection.updateOne(
          { code: req.query.code },
          {
            $set: {
              payment: "failed",
              // transactionId: req.params.tranId
            },
          }
        );
        if (result.modifiedCount > 0) {
          res.redirect(
            `http://localhost:5173/api/v1/payment-failed/${req.params.tranId}`
          );
        }
      });
    });

    // placed order
    app.post("/api/v1/user/food-order", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });

    // delete a food
    app.delete("/api/v1/user/delete-food/:foodId", async (req, res) => {
      const id = req.params.foodId;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await foodCollection.deleteOne(query);
      res.send(result);
    });
    // delete a order

    app.delete("/api/v1/user/delete-order/:orderId", async (req, res) => {
      const orderId = req.params.orderId;
      const query = { _id: new ObjectId(orderId) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });

    // update a food
    app.put("/api/v1/user/update-food/:foodId", async (req, res) => {
      const id = req.params.foodId;
      const updatedFood = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          foodName: updatedFood.foodName,
          foodImage: updatedFood.foodImage,
          foodCategory: updatedFood.foodCategory,
          quantity: updatedFood.quantity,
          price: updatedFood.price,
          foodOrigin: updatedFood.foodOrigin,
          shortDescription: updatedFood.shortDescription,
        },
      };
      const result = await foodCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // cart related api

    app.post("/api/v1/user/cart", async (req, res) => {
      const data = req.body;

      const result = await cartCollection.insertOne(data);
    });

    app.get("/api/v1/user/cart/:email", async (req, res) => {
      const email = req.params.email;
      const result = await cartCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });
    app.delete("/api/v1/user/cart/delete-item/:itemId", async (req, res) => {
      const itemId = req.params.itemId;
      console.log(itemId);
      const query = { _id: new ObjectId(itemId) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// respond with "hello world" when a get request is made to the homepage
app.get("/", (req, res) => {
  res.send("Restaurant is running");
});

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
});
