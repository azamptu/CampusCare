
import { db, auth } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    updateDoc,
    deleteDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

console.log("CampusCare Firebase Connected!");


// ==========================================
// 1. GLOBAL VARIABLES
// ==========================================

let currentUser = null;
let currentRole = null;

let allComplaints = [];
let unsubscribeComplaints = null;

let adminNotificationsInitialized = false;

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = "ykncmcs8";
const CLOUDINARY_UPLOAD_PRESET = "campuscare_upload";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
];

// EmailJS configuration
const EMAILJS_PUBLIC_KEY = "PGPabnpzoqwg96_EA";
const EMAILJS_SERVICE_ID = "service_yzfyprp";
const EMAILJS_TEMPLATE_ID = "template_1gfevik";

let emailJsLoadPromise = null;


// ==========================================
// 2. EMAILJS LOADER
// ==========================================

async function loadEmailJS() {

    if (window.emailjs) {

        window.emailjs.init({
            publicKey: EMAILJS_PUBLIC_KEY
        });

        return;
    }

    if (!emailJsLoadPromise) {

        emailJsLoadPromise = new Promise((resolve, reject) => {

            const script = document.createElement("script");

            script.src =
                "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";

            script.onload = () => {

                try {

                    window.emailjs.init({
                        publicKey: EMAILJS_PUBLIC_KEY
                    });

                    resolve();

                } catch (error) {

                    emailJsLoadPromise = null;
                    reject(error);

                }

            };

            script.onerror = () => {

                emailJsLoadPromise = null;

                reject(
                    new Error("EmailJS could not be loaded.")
                );

            };

            document.head.appendChild(script);

        });

    }

    return emailJsLoadPromise;
}


// ==========================================
// 3. SEND ADMIN EMAIL NOTIFICATION
// ==========================================

async function sendAdminEmailNotification(complaint) {

    await loadEmailJS();

    const templateParams = {

        to_email: "ptuazam@gmail.com",

        name: complaint.studentName,

        email: complaint.email,

        subject: "New CampusCare Complaint: " + complaint.title,

        message:
            "A new complaint has been submitted.\n\n" +
            "Complaint ID: " + complaint.id + "\n" +
            "Student Name: " + complaint.studentName + "\n" +
            "Roll Number: " + complaint.studentId + "\n" +
            "Student Email: " + complaint.email + "\n" +
            "Category: " + complaint.category + "\n" +
            "Location: " + complaint.location + "\n" +
            "Title: " + complaint.title + "\n" +
            "Description: " + complaint.description + "\n" +
            "Date: " + complaint.date

    };

    return window.emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams
    );
}


// ==========================================
// 4. SEND STUDENT REPLY EMAIL NOTIFICATION
// ==========================================

async function sendStudentReplyEmail(complaint, adminReply) {

    if (!complaint.email) {

        throw new Error("Student email address is missing.");

    }

    await loadEmailJS();

    const templateParams = {

        to_email: complaint.email,

        name: complaint.studentName,

        email: complaint.email,

        subject:
            "Admin replied to your CampusCare Complaint - " +
            complaint.id,

        message:
            "Hello " + complaint.studentName + ",\n\n" +
            "The CampusCare Admin has replied to your complaint.\n\n" +
            "Complaint ID: " + complaint.id + "\n" +
            "Complaint Title: " + complaint.title + "\n" +
            "Category: " + complaint.category + "\n\n" +
            "Admin Response:\n" +
            adminReply + "\n\n" +
            "Please login to CampusCare to track your complaint.\n\n" +
            "Regards,\nCampusCare Team"

    };

    return window.emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams
    );
}


// ==========================================
// 5. AUTHENTICATION ELEMENTS
// ==========================================

// Student elements
const authSection = document.getElementById("authSection");
const studentDashboard = document.getElementById("studentDashboard");

const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");

const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const authMessage = document.getElementById("authMessage");

// Admin elements
const adminAuthSection = document.getElementById("adminAuthSection");
const adminDashboard = document.getElementById("adminDashboard");

const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");

const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

const adminAuthMessage = document.getElementById("adminAuthMessage");

// Image elements
const complaintImage = document.getElementById("complaintImage");
const imagePreview = document.getElementById("imagePreview");


// ==========================================
// 6. MESSAGE FUNCTIONS
// ==========================================

function showAuthMessage(message, type) {

    authMessage.textContent = message;
    authMessage.className = "message " + type;

}

function showAdminAuthMessage(message, type) {

    adminAuthMessage.textContent = message;
    adminAuthMessage.className = "message " + type;

}

function showMessage(message, type) {

    const formMessage = document.getElementById("formMessage");

    formMessage.textContent = message;
    formMessage.className = "message " + type;

}

function getAuthError(error) {

    const messages = {

        "auth/email-already-in-use":
            "This email is already registered.",

        "auth/invalid-email":
            "Please enter a valid email address.",

        "auth/weak-password":
            "Password must contain at least 6 characters.",

        "auth/invalid-credential":
            "Incorrect email or password.",

        "auth/user-not-found":
            "Account not found.",

        "auth/wrong-password":
            "Incorrect password.",

        "auth/too-many-requests":
            "Too many attempts. Please try again later.",

        "auth/network-request-failed":
            "Network error. Check your internet connection."

    };

    return messages[error.code] || error.message;

}


// ==========================================
// 7. IMAGE VALIDATION
// ==========================================

function validateImage(file) {

    if (!file) return "Please select an image.";

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {

        return "Only JPG, PNG and WEBP images are allowed.";

    }

    if (file.size > MAX_IMAGE_SIZE) {

        return "Image size must be less than 5 MB.";

    }

    return null;

}


// ==========================================
// 8. IMAGE PREVIEW
// ==========================================

let previewObjectURL = null;

if (complaintImage && imagePreview) {

    complaintImage.addEventListener("change", function() {

        const file = complaintImage.files[0];

        if (previewObjectURL) {

            URL.revokeObjectURL(previewObjectURL);
            previewObjectURL = null;

        }

        imagePreview.hidden = true;
        imagePreview.removeAttribute("src");

        if (!file) return;

        const validationError = validateImage(file);

        if (validationError) {

            showMessage(validationError, "error");

            complaintImage.value = "";

            return;

        }

        previewObjectURL = URL.createObjectURL(file);

        imagePreview.src = previewObjectURL;
        imagePreview.hidden = false;

        showMessage("Image selected successfully.", "success");

    });

}


// ==========================================
// 9. UPLOAD IMAGE TO CLOUDINARY
// ==========================================

async function uploadImageToCloudinary(file) {

    const validationError = validateImage(file);

    if (validationError) {

        throw new Error(validationError);

    }

    const uploadURL =
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(uploadURL, {

        method: "POST",
        body: formData

    });

    const result = await response.json();

    if (!response.ok) {

        console.error("Cloudinary upload error:", result);

        throw new Error(
            result.error?.message || "Image upload failed."
        );

    }

    if (!result.secure_url) {

        throw new Error("Cloudinary did not return an image URL.");

    }

    return {

        imageUrl: result.secure_url,
        imagePublicId: result.public_id || ""

    };

}


// ==========================================
// 10. STUDENT REGISTRATION
// ==========================================

registerBtn.addEventListener("click", async function() {

    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || !password) {

        showAuthMessage(
            "Please enter email and password.",
            "error"
        );

        return;

    }

    try {

        registerBtn.disabled = true;

        showAuthMessage(
            "Creating your account...",
            "success"
        );

        await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

        showAuthMessage(
            "Account created successfully!",
            "success"
        );

    } catch (error) {

        showAuthMessage(getAuthError(error), "error");

    } finally {

        registerBtn.disabled = false;

    }

});


// ==========================================
// 11. STUDENT LOGIN
// ==========================================

loginBtn.addEventListener("click", async function() {

    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || !password) {

        showAuthMessage(
            "Please enter email and password.",
            "error"
        );

        return;

    }

    try {

        loginBtn.disabled = true;

        showAuthMessage("Logging in...", "success");

        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        showAuthMessage(
            "Login successful!",
            "success"
        );

    } catch (error) {

        showAuthMessage(getAuthError(error), "error");

    } finally {

        loginBtn.disabled = false;

    }

});


// ==========================================
// 12. STUDENT LOGOUT
// ==========================================

logoutBtn.addEventListener("click", async function() {

    try {

        await signOut(auth);

        showAuthMessage(
            "You have logged out successfully.",
            "success"
        );

    } catch (error) {

        showAuthMessage(getAuthError(error), "error");

    }

});


// ==========================================
// 13. ADMIN BROWSER NOTIFICATIONS
// ==========================================

function requestAdminNotificationPermission() {

    if (!("Notification" in window)) {

        console.log(
            "Browser notifications are not supported."
        );

        return;

    }

    if (Notification.permission === "default") {

        Notification.requestPermission().then(permission => {

            console.log(
                "Notification permission:",
                permission
            );

        }).catch(error => {

            console.error(
                "Notification permission error:",
                error
            );

        });

    }

}


function showAdminBrowserNotification(complaint) {

    if (!("Notification" in window)) return;

    if (Notification.permission !== "granted") return;

    try {

        const notification = new Notification(
            "New CampusCare Complaint",
            {

                body:
                    complaint.studentName +
                    " submitted: " +
                    complaint.title

            }
        );

        notification.onclick = function() {

            window.focus();
            notification.close();

        };

    } catch (error) {

        console.error(
            "Browser notification error:",
            error
        );

    }

}


// ==========================================
// 14. ADMIN LOGIN
// ==========================================

adminLoginBtn.addEventListener("click", async function() {

    const email = adminEmail.value.trim();
    const password = adminPassword.value;

    if (!email || !password) {

        showAdminAuthMessage(
            "Please enter email and password.",
            "error"
        );

        return;

    }

    try {

        adminLoginBtn.disabled = true;

        showAdminAuthMessage(
            "Verifying admin account...",
            "success"
        );

        const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        const user = userCredential.user;

        const adminRef = doc(db, "admins", user.uid);

        const adminSnapshot = await getDoc(adminRef);

        if (
            !adminSnapshot.exists() ||
            adminSnapshot.data().role !== "admin"
        ) {

            await signOut(auth);

            showAdminAuthMessage(
                "This account is not authorized as admin.",
                "error"
            );

            return;

        }

        showAdminAuthMessage(
            "Admin login successful!",
            "success"
        );

        requestAdminNotificationPermission();

    } catch (error) {

        showAdminAuthMessage(
            getAuthError(error),
            "error"
        );

    } finally {

        adminLoginBtn.disabled = false;

    }

});


// ==========================================
// 15. ADMIN LOGOUT
// ==========================================

adminLogoutBtn.addEventListener("click", async function() {

    try {

        await signOut(auth);

        showAdminAuthMessage(
            "Admin logged out successfully.",
            "success"
        );

    } catch (error) {

        showAdminAuthMessage(
            getAuthError(error),
            "error"
        );

    }

});


// ==========================================
// 16. AUTHENTICATION STATE
// ==========================================

onAuthStateChanged(auth, async function(user) {

    currentUser = user;
    currentRole = null;

    if (unsubscribeComplaints) {

        unsubscribeComplaints();
        unsubscribeComplaints = null;

    }

    allComplaints = [];

    adminNotificationsInitialized = false;

    authSection.hidden = true;
    studentDashboard.hidden = true;

    adminAuthSection.hidden = true;
    adminDashboard.hidden = true;

    if (!user) {

        authSection.hidden = false;
        adminAuthSection.hidden = false;

        authEmail.value = "";
        authPassword.value = "";

        adminEmail.value = "";
        adminPassword.value = "";

        return;

    }

    try {

        const adminRef = doc(db, "admins", user.uid);

        const adminSnapshot = await getDoc(adminRef);

        if (
            adminSnapshot.exists() &&
            adminSnapshot.data().role === "admin"
        ) {

            currentRole = "admin";

            adminDashboard.hidden = false;

            startAdminListener();

        } else {

            currentRole = "student";

            studentDashboard.hidden = false;

            document.getElementById("studentEmail").value =
                user.email || "";

        }

    } catch (error) {

        console.error(
            "Role verification failed:",
            error
        );

        currentRole = null;

        authSection.hidden = false;
        adminAuthSection.hidden = false;

        showAuthMessage(
            "Unable to verify account. Please try again.",
            "error"
        );

    }

});


// ==========================================
// 17. SAFE HTML
// ==========================================

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"

    })[char]);

}


// ==========================================
// 18. NAVIGATION
// ==========================================

const navButtons = document.querySelectorAll(".nav-btn");
const pages = document.querySelectorAll(".page");

navButtons.forEach(button => {

    button.addEventListener("click", () => {

        const pageId = button.dataset.page;

        if (
            pageId === "adminPage" &&
            currentRole !== "admin"
        ) {

            adminAuthSection.hidden = false;
            adminDashboard.hidden = true;

        }

        pages.forEach(page => {

            page.classList.remove("active-page");

        });

        navButtons.forEach(nav => {

            nav.classList.remove("active");

        });

        document.getElementById(pageId).classList.add("active-page");

        button.classList.add("active");

        if (
            pageId === "adminPage" &&
            currentRole === "admin"
        ) {

            requestAdminNotificationPermission();

            renderAdmin();

        }

    });

});


// ==========================================
// 19. SUBMIT COMPLAINT TO FIRESTORE
// ==========================================

const complaintForm = document.getElementById("complaintForm");

complaintForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    if (!currentUser || currentRole !== "student") {

        showMessage(
            "Please login with a student account.",
            "error"
        );

        return;

    }

    const newComplaint = {

        id: "CC-" + Date.now().toString().slice(-8),

        studentName:
            document.getElementById("studentName").value.trim(),

        studentId:
            document.getElementById("studentId").value.trim(),

        email: currentUser.email || "",

        category:
            document.getElementById("category").value,

        location:
            document.getElementById("location").value.trim(),

        title:
            document.getElementById("complaintTitle").value.trim(),

        description:
            document.getElementById("description").value.trim(),

        status: "Pending",

        date: new Date().toLocaleString(),

        uid: currentUser.uid,

        imageUrl: "",

        imagePublicId: ""

    };

    if (
        !newComplaint.studentName ||
        !newComplaint.studentId ||
        !newComplaint.email ||
        !newComplaint.category ||
        !newComplaint.location ||
        !newComplaint.title ||
        !newComplaint.description
    ) {

        showMessage(
            "Please fill in all required fields.",
            "error"
        );

        return;

    }

    const selectedImage = complaintImage?.files[0] || null;

    if (selectedImage) {

        const validationError = validateImage(selectedImage);

        if (validationError) {

            showMessage(validationError, "error");

            return;

        }

    }

    const submitButton = complaintForm.querySelector(
        'button[type="submit"]'
    );

    try {

        if (submitButton) {
            submitButton.disabled = true;
        }

        if (selectedImage) {

            showMessage(
                "Uploading complaint image...",
                "success"
            );

            const uploadedImage = await uploadImageToCloudinary(
                selectedImage
            );

            newComplaint.imageUrl = uploadedImage.imageUrl;

            newComplaint.imagePublicId =
                uploadedImage.imagePublicId;

        }

        showMessage(
            "Submitting your complaint...",
            "success"
        );

        // Save complaint in Firestore first
        await addDoc(
            collection(db, "complaints"),
            newComplaint
        );

        // Send email notification to admin
        let emailNotificationSent = false;

        try {

            await sendAdminEmailNotification(newComplaint);

            emailNotificationSent = true;

            console.log(
                "Admin email notification sent successfully!"
            );

        } catch (emailError) {

            console.error(
                "Admin email notification failed:",
                emailError
            );

        }

        complaintForm.reset();

        document.getElementById("studentEmail").value =
            currentUser.email || "";

        if (imagePreview) {

            imagePreview.hidden = true;
            imagePreview.removeAttribute("src");

        }

        if (previewObjectURL) {

            URL.revokeObjectURL(previewObjectURL);
            previewObjectURL = null;

        }

        showMessage(

            emailNotificationSent

                ? "Complaint submitted successfully! Admin has been notified by email. Complaint ID: " +
                  newComplaint.id

                : "Complaint submitted successfully! Complaint ID: " +
                  newComplaint.id +
                  ". Email notification could not be sent.",

            "success"

        );

    } catch (error) {

        console.error(
            "Complaint submission error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to submit complaint. Please try again.",
            "error"
        );

    } finally {

        if (submitButton) {
            submitButton.disabled = false;
        }

    }

});


// ==========================================
// 20. TRACK COMPLAINT FROM FIRESTORE
// ==========================================

const trackForm = document.getElementById("trackForm");

trackForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    if (!currentUser || currentRole !== "student") return;

    const enteredId = document.getElementById("trackId")
        .value.trim().toUpperCase();

    const result = document.getElementById("trackResult");

    if (!enteredId) {

        result.textContent = "Please enter your Complaint ID.";

        return;

    }

    try {

        result.textContent = "Searching complaint...";

        const complaintQuery = query(

            collection(db, "complaints"),

            where("uid", "==", currentUser.uid),

            where("id", "==", enteredId)

        );

        const snapshot = await getDocs(complaintQuery);

        if (snapshot.empty) {

            result.innerHTML = `
                <div class="track-result">
                    <strong style="color:#c44747">
                        Complaint not found.
                    </strong>
                    <p>Please check your Complaint ID.</p>
                </div>
            `;

            return;

        }

        const complaint = snapshot.docs[0].data();

        result.innerHTML = `

            <div class="track-result">

                <strong>${escapeHTML(complaint.id)}</strong>

                <p>${escapeHTML(complaint.title)}</p>

                <p>Status:

                    <span class="status-badge ${getStatusClass(complaint.status)}">
                        ${escapeHTML(complaint.status)}
                    </span>

                </p>

                <p>Category: ${escapeHTML(complaint.category)}</p>

                <p>Submitted: ${escapeHTML(complaint.date)}</p>

                <div class="admin-response"
                    style="margin-top:15px; padding:12px; border-radius:8px; background:#f1f5f9;">

                    <strong>Admin Response</strong>

                    <p>
                        ${complaint.adminReply
                            ? escapeHTML(complaint.adminReply)
                            : "No response from admin yet."}
                    </p>

                </div>

            </div>

        `;

    } catch (error) {

        console.error(
            "Tracking error:",
            error
        );

        result.textContent =
            "Unable to track complaint. Please try again.";

    }

});


// ==========================================
// 21. ADMIN DASHBOARD ELEMENTS
// ==========================================

const complaintsList = document.getElementById("complaintsList");

const statusFilter = document.getElementById("statusFilter");

const categoryFilter = document.getElementById("categoryFilter");

const complaintSearch = document.getElementById("complaintSearch");


// ==========================================
// 22. STATUS CLASS
// ==========================================

function getStatusClass(status) {

    if (status === "Resolved") {
        return "status-resolved";
    }

    if (status === "In Progress") {
        return "status-in-progress";
    }

    return "status-pending";

}


// ==========================================
// 23. REAL-TIME FIRESTORE LISTENER
// ==========================================

function startAdminListener() {

    if (currentRole !== "admin") return;

    if (unsubscribeComplaints) return;

    unsubscribeComplaints = onSnapshot(

        collection(db, "complaints"),

        function(snapshot) {

            // Ignore existing complaints in first snapshot.
            // Notify only about newly added complaints.

            if (adminNotificationsInitialized) {

                snapshot.docChanges().forEach(change => {

                    if (change.type === "added") {

                        const complaint = change.doc.data();

                        showAdminBrowserNotification(complaint);

                    }

                });

            }

            adminNotificationsInitialized = true;

            allComplaints = snapshot.docs.map(document => ({

                ...document.data(),

                firestoreId: document.id

            }));

            console.log(
                "Complaints loaded:",
                allComplaints.length
            );

            renderAdmin();

        },

        function(error) {

            console.error(
                "Admin complaints loading error:",
                error
            );

            complaintsList.innerHTML = `

                <div class="empty-state">

                    <h3>Unable to load complaints</h3>

                    <p>Please check your Firestore permissions.</p>

                </div>

            `;

        }

    );

}


// ==========================================
// 24. RENDER ADMIN DASHBOARD
// ==========================================

function renderAdmin() {

    if (currentRole !== "admin") return;

    const complaints = allComplaints;

    const total = complaints.length;

    const pending = complaints.filter(
        c => c.status === "Pending"
    ).length;

    const progress = complaints.filter(
        c => c.status === "In Progress"
    ).length;

    const resolved = complaints.filter(
        c => c.status === "Resolved"
    ).length;

    document.getElementById("totalCount").textContent = total;

    document.getElementById("pendingCount").textContent = pending;

    document.getElementById("progressCount").textContent = progress;

    document.getElementById("resolvedCount").textContent = resolved;


    const status = statusFilter.value;

    const category = categoryFilter.value;

    const search = complaintSearch.value.trim().toLowerCase();


    const filteredComplaints = complaints.filter(c => {

        const matchesStatus =
            status === "All" || c.status === status;

        const matchesCategory =
            category === "All" || c.category === category;

        const searchableText = [

            c.id,
            c.studentName,
            c.studentId,
            c.title,
            c.category,
            c.location,
            c.email

        ].join(" ").toLowerCase();

        const matchesSearch =
            searchableText.includes(search);

        return matchesStatus && matchesCategory && matchesSearch;

    });


    if (filteredComplaints.length === 0) {

        complaintsList.innerHTML = `

            <div class="empty-state">

                <span>▤</span>

                <h3>No complaints found</h3>

                <p>There are no complaints in this category.</p>

            </div>

        `;

        return;

    }


    complaintsList.innerHTML = filteredComplaints.map(complaint => `

        <div class="complaint-item">

            <div class="complaint-top">

                <div>

                    <h4>${escapeHTML(complaint.title)}</h4>

                    <div class="complaint-meta">

                        ${escapeHTML(complaint.id)} •
                        ${escapeHTML(complaint.date)}

                    </div>

                </div>

                <span class="status-badge ${getStatusClass(complaint.status)}">

                    ${escapeHTML(complaint.status)}

                </span>

            </div>


            <div class="complaint-description">

                <strong>Student:</strong>
                ${escapeHTML(complaint.studentName)}<br>

                <strong>Roll No:</strong>
                ${escapeHTML(complaint.studentId)}<br>

                <strong>Email:</strong>
                ${escapeHTML(complaint.email)}<br>

                <strong>Category:</strong>
                ${escapeHTML(complaint.category)}<br>

                <strong>Location:</strong>
                ${escapeHTML(complaint.location)}<br><br>

                ${escapeHTML(complaint.description)}

            </div>


            ${
                complaint.imageUrl &&
                /^https:\/\/res\.cloudinary\.com\/ykncmcs8\/image\/upload\//.test(complaint.imageUrl)

                ? `

                    <div class="complaint-evidence"
                        style="margin-top:15px;">

                        <strong>Attached Evidence:</strong><br>

                        <a
                            href="${escapeHTML(complaint.imageUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >

                            <img
                                src="${escapeHTML(complaint.imageUrl)}"
                                alt="Complaint evidence"
                                loading="lazy"
                                style="max-width:220px; max-height:180px; object-fit:cover; border-radius:10px; margin-top:10px; display:block;"
                            >

                        </a>

                    </div>

                `

                : ""

            }


            <div class="complaint-actions">

                <select
                    class="status-select"
                    data-firestore-id="${escapeHTML(complaint.firestoreId)}"
                >

                    <option value="Pending" ${complaint.status === "Pending" ? "selected" : ""}>
                        Pending
                    </option>

                    <option value="In Progress" ${complaint.status === "In Progress" ? "selected" : ""}>
                        In Progress
                    </option>

                    <option value="Resolved" ${complaint.status === "Resolved" ? "selected" : ""}>
                        Resolved
                    </option>

                </select>


                <button
                    class="delete-btn"
                    data-delete="${escapeHTML(complaint.firestoreId)}"
                >

                    Delete Complaint

                </button>

            </div>


            <div class="admin-reply-box"
                style="margin-top:15px;">

                <label>Admin Response</label>

                <textarea
                    class="admin-reply-input"
                    data-reply-id="${escapeHTML(complaint.firestoreId)}"
                    placeholder="Write your response to the student..."
                    maxlength="2000"
                    rows="3"
                    style="width:100%; padding:12px; margin-top:8px;"
                >${escapeHTML(complaint.adminReply || "")}</textarea>


                <button
                    class="reply-btn"
                    data-reply="${escapeHTML(complaint.firestoreId)}"
                    style="margin-top:10px;"
                >

                    Save Response

                </button>

            </div>

        </div>

    `).join("");

}


// ==========================================
// 25. SEARCH AND FILTERS
// ==========================================

statusFilter.addEventListener("change", renderAdmin);

categoryFilter.addEventListener("change", renderAdmin);

complaintSearch.addEventListener("input", renderAdmin);


// ==========================================
// 26. UPDATE COMPLAINT STATUS IN FIRESTORE
// ==========================================

complaintsList.addEventListener("change", async function(event) {

    if (
        currentRole !== "admin" ||
        !event.target.classList.contains("status-select")
    ) return;

    const firestoreId = event.target.dataset.firestoreId;

    const newStatus = event.target.value;

    const allowedStatuses = [

        "Pending",
        "In Progress",
        "Resolved"

    ];

    if (!allowedStatuses.includes(newStatus)) return;

    try {

        await updateDoc(

            doc(db, "complaints", firestoreId),

            {
                status: newStatus
            }

        );

        console.log("Complaint status updated!");

    } catch (error) {

        console.error(
            "Status update error:",
            error
        );

        alert("Unable to update complaint status.");

    }

});


// ==========================================
// 27. DELETE COMPLAINT FROM FIRESTORE
// ==========================================

complaintsList.addEventListener("click", async function(event) {

    if (currentRole !== "admin") return;

    const button = event.target.closest("[data-delete]");

    if (!button) return;

    const firestoreId = button.dataset.delete;

    if (!confirm("Are you sure you want to delete this complaint?")) {

        return;

    }

    try {

        button.disabled = true;

        await deleteDoc(
            doc(db, "complaints", firestoreId)
        );

        console.log("Complaint deleted successfully!");

    } catch (error) {

        console.error(
            "Delete complaint error:",
            error
        );

        alert("Unable to delete complaint.");

        button.disabled = false;

    }

});


// ==========================================
// 28. SAVE ADMIN RESPONSE + EMAIL STUDENT
// ==========================================

complaintsList.addEventListener("click", async function(event) {

    if (currentRole !== "admin") return;

    const button = event.target.closest("[data-reply]");

    if (!button) return;

    const firestoreId = button.dataset.reply;

    const textarea = complaintsList.querySelector(
        `[data-reply-id="${firestoreId}"]`
    );

    if (!textarea) return;

    const adminReply = textarea.value.trim();

    if (!adminReply) {

        alert("Please write a response first.");

        return;

    }

    const complaint = allComplaints.find(
        item => item.firestoreId === firestoreId
    );

    if (!complaint) {

        alert("Complaint not found. Please refresh the page.");

        return;

    }

    const replyChanged =
        adminReply !== (complaint.adminReply || "");

    try {

        button.disabled = true;

        button.textContent = "Saving...";

        // Save reply in Firestore first
        await updateDoc(

            doc(db, "complaints", firestoreId),

            {
                adminReply: adminReply
            }

        );

        console.log(
            "Admin response saved successfully!"
        );

        // Send email only for a new or changed reply
        if (replyChanged) {

            button.textContent = "Sending Email...";

            try {

                await sendStudentReplyEmail(
                    complaint,
                    adminReply
                );

                console.log(
                    "Student reply email sent successfully!"
                );

                alert(
                    "Admin response saved and email sent to the student!"
                );

            } catch (emailError) {

                console.error(
                    "Student reply email failed:",
                    emailError
                );

                alert(
                    "Response saved successfully, but student email could not be sent. Check the Console."
                );

            }

        } else {

            alert(
                "Response saved. No email sent because the reply was unchanged."
            );

        }

        button.textContent = "Saved";

    } catch (error) {

        console.error(
            "Admin response error:",
            error
        );

        alert(
            "Unable to save response. Please try again."
        );

        button.textContent = "Save Response";

    } finally {

        button.disabled = false;

    }

});


// ==========================================
// 29. INITIALIZATION
// ==========================================

console.log("CampusCare Application Loaded!");
