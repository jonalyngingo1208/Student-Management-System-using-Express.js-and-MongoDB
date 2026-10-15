const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;

// MIDDLEWARE
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// SESSION
app.use(session({
    secret: process.env.SESSION_SECRET || "student-management-secret",
    resave: false,
    saveUninitialized: false
}));

// EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// LOGIN PROTECTION
function requireLogin(req, res, next) {
    if (req.session.user) {
        return next();
    }

    res.redirect("/login");
}

// MONGODB CONNECTION
mongoose.connect(
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/student_management"
)
.then(() => {
    console.log("MongoDB connected successfully!");
})
.catch((error) => {
    console.log("MongoDB connection error:", error.message);
});

// STUDENT SCHEMA
const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    course: {
        type: String,
        required: true,
        trim: true
    },
    age: {
        type: Number,
        required: true,
        min: 1
    },
    city: {
        type: String,
        required: true,
        trim: true
    }
});

const Student = mongoose.model("Student", studentSchema);

// HOME
app.get("/", (req, res) => {
    if (req.session.user) {
        return res.redirect("/students");
    }

    res.render("index");
});

// LOGIN PAGE
app.get("/login", (req, res) => {
    if (req.session.user) {
        return res.redirect("/students");
    }

    res.render("login");
});

// LOGIN
app.post("/login", (req, res) => {
    const username = req.body.username?.trim();

    if (!username) {
        return res.status(400).send("Please enter a username.");
    }

    req.session.user = {
        name: username
    };

    console.log("User logged in:", username);
    res.redirect("/students");
});

// DISPLAY STUDENTS
app.get("/students", requireLogin, async (req, res) => {
    try {
        const students = await Student.find().sort({ name: 1 });

        res.render("students", {
            students,
            user: req.session.user
        });
    } catch (error) {
        console.log("Error loading students:", error);
        res.status(500).send("Error loading students.");
    }
});

// ADD STUDENT
app.post("/students", requireLogin, async (req, res) => {
    try {
        const { name, course, age, city } = req.body;

        if (
            !name?.trim() ||
            !course?.trim() ||
            !age ||
            !city?.trim()
        ) {
            return res.status(400).send("Please complete all student fields.");
        }

        const newStudent = new Student({
            name: name.trim(),
            course: course.trim(),
            age: Number(age),
            city: city.trim()
        });

        await newStudent.save();

        console.log("Student added successfully!");
        res.redirect("/students");
    } catch (error) {
        console.log("Error adding student:", error.message);
        res.status(400).send("Unable to add student. Check the information.");
    }
});

// EDIT PAGE - LOAD EXISTING STUDENT
app.get("/students/edit/:id", requireLogin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).send("Invalid student ID.");
        }

        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).send("Student not found.");
        }

        res.render("edit-student", {
            student,
            user: req.session.user
        });
    } catch (error) {
        console.log("Error opening edit page:", error.message);
        res.status(500).send("Unable to open edit page.");
    }
});

// UPDATE STUDENT - SAVE CHANGES TO MONGODB
app.post("/students/update/:id", requireLogin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).send("Invalid student ID.");
        }

        const { name, course, age, city } = req.body;

        if (
            !name?.trim() ||
            !course?.trim() ||
            !age ||
            !city?.trim()
        ) {
            return res.status(400).send("Please complete all student fields.");
        }

        const updatedStudent = await Student.findByIdAndUpdate(
            req.params.id,
            {
                name: name.trim(),
                course: course.trim(),
                age: Number(age),
                city: city.trim()
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedStudent) {
            return res.status(404).send("Student not found.");
        }

        console.log("Student updated:", updatedStudent.name);
        res.redirect("/students");
    } catch (error) {
        console.log("Error updating student:", error.message);
        res.status(400).send("Unable to update student. Check the information.");
    }
});

// DELETE STUDENT
app.post("/students/delete/:id", requireLogin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).send("Invalid student ID.");
        }

        const deletedStudent = await Student.findByIdAndDelete(req.params.id);

        if (!deletedStudent) {
            return res.status(404).send("Student not found.");
        }

        console.log("Student deleted:", deletedStudent.name);
        res.redirect("/students");
    } catch (error) {
        console.log("Error deleting student:", error.message);
        res.status(500).send("Error deleting student.");
    }
});

// LOGOUT
app.get("/logout", requireLogin, (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.log("Error logging out:", error);
            return res.status(500).send("Error logging out.");
        }

        res.redirect("/login");
    });
});

// 404
app.use((req, res) => {
    res.status(404).send("Page not found.");
});

// START SERVER
app.listen(PORT, () => {
    console.log("=================================");
    console.log("Student Management System");
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("=================================");
});
