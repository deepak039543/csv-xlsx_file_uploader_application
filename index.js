const express = require("express");
const app = express();

const hbs = require("hbs");
const path = require("path");
const multer = require('multer');
const csvtojson = require('csvtojson');
const xlsx = require("xlsx");
const bodyParser = require('body-parser');
const port = 3000;


//use json file
app.use(express.json());
//use cookie parser as a middleware
// app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));



//connect with the mongodb
require("./db/connection.js");
//connect with schema mode
const Employee = require("./models/schema.js");

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' });


//use template engine " hbs"
app.set("view engine", "hbs");

//render the index page for uploading csv and xlsx file
app.get("/", (req, res) => {
    res.status(201).render("index");
})

//when admin wants to see all the data saved in mongodb on viewData page render the viewData page
app.get("/viewData", async (req, res) => {

    try {

        const page = parseInt(req.query.page) || 1; // Default to page 1 if no page parameter is provided
        const perPage = 10; // Number of records to display per page



        let sortOrder = 1;

        // Check the 'sort' query parameter to determine the sorting order
        if (req.query.sort === '-username') {
            sortOrder = -1; // Descending order
        }

        // Calculate the number of records to skip based on the current page
        const skip = (page - 1) * perPage;

        const totalUsers = await Employee.countDocuments();
        const totalPages = Math.ceil(totalUsers / perPage);




    //find the all users data from mongodb
        const users = await Employee.find()
            .collation({ locale: 'en_US', strength: 2 })
            .sort({ name: sortOrder })
            .skip(skip)
            .limit(perPage)



      
        const formattedUsers = users.map((user) => {
            return {
                name: user.name,
                userID: user._id.toHexString(),
                mobile: user.mobile,
                categories: user.categories,

            };
        });
        // if there are previous and next pages

        const hasPrevPage = page > 1;
        const hasNextPage = page < totalPages;

        // Render the viewData page with the user data
        res.render("viewData", {
            users: formattedUsers,
            hasPrevPage,
            hasNextPage,
            prevPage: page - 1,
            nextPage: page + 1,
            sort: req.query.sort || 'name', // Maintain the sorting order in pagination links
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }

})


// route for handling CSV & XLSX file upload and saving to MongoDB
app.post('/index', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).render('index', { error: '*No file uploaded' });
        }
   
        const filePath = req.file.path; // check the file path
        const fileType = req.file.mimetype;//check the file type
        let jsonArray; //create a array

        //check file type is CSV or XLSX
        if (fileType === 'text/csv') {

            jsonArray = await csvtojson({ //use csvtojson libruary for change all csv data in json format
                noheader: false,
                headers: ['name', 'mobile'],
            }).fromFile(filePath);
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            // XLSX file: Read and parse using xlsx library
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            jsonArray = xlsx.utils.sheet_to_json(sheet);
        } else {
            // Unsupported file type
            return res.status(400).render('index', { error: '*Unsupported file type' });
        }
        // Check if the first row contains the" name" and" mobile" headers
        const firstRow = jsonArray[0];
        if (!firstRow || !firstRow.name || !firstRow.mobile) {
            return res.status(400).render('index', { error: '*Invalid or missing headers' });
        }

        // check that the file contains only two columns (name and mobile)
        if (Object.keys(firstRow).length !== 2) {
            return res.status(400).render('index', { error: '*File must contain exactly two columns: name and mobile' });
        }

        // Save the CSV and XLSX data to MongoDB using Employee collection
        await Employee.insertMany(jsonArray);

        // res.status(200).json({ message: 'File data saved successfully' });
        //render the viewData page
        res.status(200).redirect("/viewData");
    } catch (error) {
        console.error('Error saving File data:', error);
        res.status(500).json({ error: 'Error saving File data', details: error.message });
    }
});

// Define a route for bulk editing
app.post('/bulk-edit', async (req, res) => {
    try {
        // const selectedUsersData = req.body.selectedUsersData;
        const selectedUsersData = req.body.selectedUsers; //fetch all selected users data 
        const newCategory = req.body.newCategory;//fetch the new category 
        console.log(selectedUsersData);
        console.log(req.body.newCategory);
        // Process the selectedUsersData and update the data for each user
        for (const userData of selectedUsersData) {
            const { name, mobile, categories } = userData;

           
            await Employee.updateCategoryByNameAndMobile(name, mobile, newCategory);
        }

        
        // res.status(200).json({ message: 'Bulk editing successful' });
        res.status(200).redirect("/viewData");
    } catch (error) {
        console.error('Error during bulk edit:', error);
       
        res.status(500).json({ message: 'Bulk editing failed' });
    }
});

//render the popup model for editing name and mobile individually with existing name and mobile
app.get('/getUserRole/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Fetch the user's role from MongoDB
        const user = await Employee.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return the user's role as a response
        return res.status(200).json({ name: user.name, mobile: user.mobile });
    } catch (error) {
        console.error('Error fetching user role:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// handle the route for updating the user's name and mobile
app.post('/updateRole/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const newname = req.body.newname;
        const newmobile = req.body.newmobile;
        console.log(newname);
        console.log(newmobile);
         //update users name and mobile in mongodb
        const user = await Employee.findOneAndUpdate(
            { _id: userId },
            { name: newname, mobile: newmobile },

            { new: true } 
        );

        // Check if the user was found and updated
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Send a success response
        return res.status(200).json({ message: 'User role updated successfully', user });
    } catch (error) {
        console.error('Error updating user role:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

const mongoose = require("mongoose");
const CastError = mongoose.Error.CastError;



// //when any user enter serach anything in searchbar then search result render to user
// app.get("/search", async (req, res) => {
//     try {
//         const searchQuery = req.query.q; // Get the search query from the URL query parameter
//         const searchCriteria = {
//             $or: [
//                 { name: { $regex: new RegExp(searchQuery, "i") } },
//                 { categories: { $regex: new RegExp(searchQuery, "i") } },
//                 {
//                     $expr: {
//                         $eq: [
//                             { $toString: "$mobile" }, // Convert the 'mobile' field to a string for comparison
//                             searchQuery
//                         ]
//                     }
//                 },
//                 // { userID: { $eq: searchQuery } }
//             ],
//         };
        

      
//         // Perform the search
//         const searchResults = await Employee.find(searchCriteria);



//         // Prepare the search results in a format to send to the client
//         const formattedResults = searchResults.map((result) => ({
//             name: result.name,
//             mobile: result.mobile,
//             categories: result.categories,
//             userID: result._id,
//             // Add more fields as needed
//         }));

//         // Send the search results as JSON to the client
//         res.json({ results: formattedResults });
//     } catch (error) {
//         if (error instanceof CastError) {
//             // Handle the cast error gracefully
//             console.error("Cast error occurred:", error);
//             res.json({ results: [] }); // Return an empty array in case of a cast error
//         } else {
//             // Handle other errors
//             console.error("Error performing search:", error);
//             res.status(500).json({ error: "Internal Server Error" });
//         }
//     }
// });



app.listen(port, () => {
    console.log(`server is runing at ${port}`);
})