// import express from "express";
// const app = express()

// (async ()=> {
//     try {
//         await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)
//         app.on("error", ()=>{
//             console.log("ERROR: "+error);
//             throw error;
//         })
        
//         app.listen(PORT, ()=>{
//             console.log(`App is listening on port: ${process.env.PORT}`);
//         })

//     } catch (error) {
//         console.log(`ERROR: ${error}`)
//     }
// })
// */

// import dotenv from "dotenv";
// // import express from "express";
// import connectDB from "./db/index.js";
// import app from "./app.js";

// dotenv.config({
//     path: '../env'
// });

// connectDB()
//     .then(() => {
//         const PORT = process.env.PORT || 8000;
//         app.listen(PORT, () => {
//             console.log(`Server is running at port: ${PORT}`);
//         });
//     })
//     .catch((err) => {
//         console.log("MONGODB connection failed", err);
//     });

import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";

dotenv.config({
    path: '../env'
});

connectDB()
.then(() => {
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
        console.log("Server is running at port: " + PORT);
    });
})
.catch((err) => {
    console.log("MONGODB connection failed", err);
});
