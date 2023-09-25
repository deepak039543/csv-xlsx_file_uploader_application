const mongoose = require("mongoose");


const csvDataSchema = new mongoose.Schema({
    name: {
        type: String,
        required: false,
    },
    mobile: {
        type: Number,
        required: false,
    },
    categories : {
        type : String,
        default : 'x',
    }
   
});

// Define a static method to update category by name and mobile
csvDataSchema.statics.updateCategoryByNameAndMobile = async function(name, mobile, newCategory) {
    try {
        const result = await this.updateMany({ name, mobile }, { $set: { categories: newCategory } });
        return result;
    } catch (error) {
        throw error;
    }
};

//create a collection "Employee"
const Employee = mongoose.model('Employee', csvDataSchema);

module.exports = Employee ;
