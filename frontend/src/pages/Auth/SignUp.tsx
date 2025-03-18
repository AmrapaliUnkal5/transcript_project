import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
//import { User, Mail, Lock, Building2, Braces, MapPinned } from "lucide-react";
import { authApi, type SignUpData } from "../../services/api";
import { Box, Button, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
//import GoogleIcon from "@mui/icons-material/Google";
//import AppleIcon from "@mui/icons-material/Apple";
//import FacebookIcon from "@mui/icons-material/Facebook";
import { grey } from "@mui/material/colors";
import { AxiosError } from "axios";
//import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import { InputAdornment, IconButton } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material"; // Icons for show/hide password
import { useAuth } from "../../context/AuthContext";
import { useLoader } from "../../context/LoaderContext";
import Loader from "../../components/Loader";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

export const SignUp = () => {
  const navigate = useNavigate();
  const { loading, setLoading } = useLoader(); // Use global loading state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false); // Modal state
  const [isConfirmPasswordTouched, setIsConfirmPasswordTouched] =
    useState(false);
  const { login } = useAuth();
  const location = useLocation();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    company_name: "",
    //website: '',
    //country: '',
    //name: '',
    email: "",
    password: "",
    phone_no: "",
    confirmPassword: "",
  });
  // Track validation errors for each field
  // const [formErrors, setFormErrors] = useState({
  //   firstName: "",
  //   lastName: "",
  //   company_name: "",
  //   email: "",
  //   password: "",
  //   phone_no: "",
  //   confirmPassword: "",
  // });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Toggle password visibility
  const handleClickShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  // Toggle confirm password visibility
  const handleClickShowConfirmPassword = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  const handleOpenModal = () => {
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updatedForm = {
        ...prev,
        [name]: value,
      };

      // Track if user has started typing in confirmPassword
      if (name === "confirmPassword") {
        setIsConfirmPasswordTouched(true);
      }

      // Validate the field as the user types
      validateField(name, value, updatedForm);

      return updatedForm;
    });

    // Clear error when user starts typing
    if (error) setError(null);
  };

  useEffect(() => {
    // Only validate confirmPassword if the user has started typing in it
    if (isConfirmPasswordTouched) {
      validateField("confirmPassword", formData.confirmPassword);
    }
  }, [formData.password, isConfirmPasswordTouched]);

  const validateField = (
    fieldName: string,
    value: string,
    updatedForm?: typeof formData
  ) => {
    let errorMessage = "";

    switch (fieldName) {
      case "email": {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errorMessage = "Please enter a valid email address.";
        }
        break;
      }

      case "password": {
        if (value.length < 8) {
          errorMessage = "Password must be at least 8 characters long.";
        }
        validateField("confirmPassword", updatedForm?.confirmPassword || "");
        break;
      }

      case "confirmPassword": {
        if (
          isConfirmPasswordTouched &&
          value !== (updatedForm?.password || formData.password)
        ) {
          errorMessage = "Passwords do not match.";
        }
        break;
      }

      case "firstName":
      case "lastName":
      case "company_name": {
        if (!value.trim()) {
          errorMessage = "This field is required.";
        }
        break;
      }
      case "phone_no": {
        const phoneRegex = /^\d+$/; // Regex to allow only digits
        if (value.trim() && !phoneRegex.test(value)) {
          errorMessage = "Please enter only numbers.";
        }
        break;
      }

      default:
        break;
    }

    setFormErrors((prev) => ({
      ...prev,
      [fieldName]: errorMessage,
    }));
  };

  const handleCredentialResponse = async (response: { credential: string }) => {
    //console.log("Credential response:", response);
    if (response.credential) {
      try {
        const res = await authApi.googleLogin(response.credential);
        //console.log(res);
        login(res.access_token, res.user);
        const from = location.state?.from?.pathname || "/";
        navigate(from, { replace: true });
      } catch (error) {
        console.error("Error during Google authentication:", error);
        setError("Google authentication failed");
      }
    } else {
      console.error("Google login failed");
    }
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log("Google API script loaded successfully");
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id:
            "752565494028-0ic7r9a791prp55aqkqe5lbjcaqfk9e1.apps.googleusercontent.com",
          callback: handleCredentialResponse,
          access_type: "offline",
          prompt: "consent",
        });

        window.google.accounts.id.renderButton(
          document.getElementById("g_signin"),
          {
            theme: "outline", // Styles the button (possible values: outline, filled_black, filled_blue)
            size: "large", // Button size (possible values: small, medium, large)
            shape: "pill", // Rounded button (possible values: rectangular, pill, circle)
            text: "none", // Controls the text (possible values: signin_with, continue_with, signup_with, none)
            logo_alignment: "center", // Aligns the Google logo (possible values: left, center)
          }
        );
      }
    };

    script.onerror = () => {
      console.error("Failed to load the Google API script");
    };

    document.body.appendChild(script);
  }, []);

  const validateForm = () => {
    let isValid = true;
    //const newErrors = { ...formErrors };

    // Validate all fields
    Object.keys(formData).forEach((fieldName) => {
      validateField(fieldName, formData[fieldName as keyof typeof formData]);
      if (formErrors[fieldName as keyof typeof formErrors]) {
        isValid = false;
      }
    });

    return isValid;
  };

  //const validateForm = () => {
  //const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Simple email format validation

  //if (!emailRegex.test(formData.email)) {
  //  setError("Please enter a valid email address.");
  //  return false;
  //}
  //if (formData.password !== formData.confirmPassword) {
  //  setError("Passwords do not match");
  //  return false;
  //}
  //if (formData.password.length < 8) {
  //  setError("Password must be at least 8 characters long");
  //  return false;
  //}
  //return true;
  //};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const signupData: SignUpData = {
        company_name: formData.company_name,
        //website: formData.website,
        //country: formData.country,
        phone_no: formData.phone_no,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        password: formData.password,
      };

      await authApi.signup(signupData);
      // Show success message
      //toast.success(
      //  "A verification email has been sent to your registered email address. Please check your inbox and follow the instructions to activate your account."
      //);
      // Wait for 3 seconds before navigating
      handleOpenModal(); // Open modal instead of navigating
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.data?.detail) {
        setError(err.response.data.detail); // Display API error message
      } else {
        setError("Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      bgcolor="#f2f1ef"
      className="min-h-screen dark:bg-gray-900 flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8"
    >
      <Dialog open={openModal} onClose={handleCloseModal}>
        <DialogTitle>Signup Successful</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            A verification email has been sent to your registered email address.
            Please check your inbox and follow the instructions to activate your
            account.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => navigate("/login")} color="primary">
            Go to Login
          </Button>
        </DialogActions>
      </Dialog>
      {loading && <Loader />}
      <ToastContainer position="top-right" autoClose={3000} />
      <Box className="max-w-lg w-full space-y-8">
        <Box bgcolor={"#FFF"} borderRadius={4} py={2} px={3}>
          <Typography variant="h6" mb={3} textAlign={"center"}>
            Sign Up
          </Typography>

          <Box>
            {/* <Typography variant='body1' color={grey[800]} mb={1}>Continue with:</Typography> */}

            <Grid container spacing={2} justifyContent="center">
              <Grid size={5}>
                <Box sx={{ cursor: "pointer", width: "100%" }}>
                  <div id="g_signin" style={{ width: "100%" }}></div>
                </Box>
              </Grid>
              {/*

              <Grid size={4}>
                <Box
                  display={"flex"}
                  justifyContent={"center"}
                  gap={2}
                  p={2}
                  borderRadius={"12px"}
                  boxShadow={"0px 2px 30px 2px rgba(0, 0, 0, 0.08);"}
                  mb={"12px"}
                  sx={{ cursor: "pointer" }}
                >
                  <AppleIcon />
                  <Typography variant="body1" color={grey[800]}>
                    Apple
                  </Typography>
                </Box>
              </Grid>
              <Grid size={4}>
                <Box
                  display={"flex"}
                  justifyContent={"center"}
                  gap={2}
                  p={2}
                  borderRadius={"12px"}
                  boxShadow={"0px 2px 30px 2px rgba(0, 0, 0, 0.08);"}
                  mb={"12px"}
                  sx={{ cursor: "pointer" }}
                >
                  <FacebookIcon />
                  <Typography variant="body1" color={grey[800]}>
                    Facebook
                  </Typography>
                </Box>
              </Grid>
              */}
            </Grid>
          </Box>

          <Typography
            variant="body1"
            textAlign={"center"}
            mt={2}
            color="grey.600"
          >
            or
          </Typography>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid size={6}>
                <TextField
                  name="firstName"
                  label="First Name"
                  variant="standard"
                  size="small"
                  fullWidth
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  error={!!formErrors.firstName}
                  helperText={formErrors.firstName}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  name="lastName"
                  label="Last Name"
                  variant="standard"
                  size="small"
                  fullWidth
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  error={!!formErrors.lastName}
                  helperText={formErrors.lastName}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  name="company_name"
                  label="Company Name"
                  variant="standard"
                  size="small"
                  fullWidth
                  required
                  value={formData.company_name}
                  onChange={handleChange}
                  error={!!formErrors.company_name}
                  helperText={formErrors.company_name}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  name="phone_no"
                  label="Contact No."
                  variant="standard"
                  size="small"
                  fullWidth
                  value={formData.phone_no}
                  onChange={handleChange}
                  error={!!formErrors.phone_no}
                  helperText={formErrors.phone_no}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  name="email"
                  label="Email"
                  variant="standard"
                  size="small"
                  fullWidth
                  required
                  value={formData.email}
                  onChange={handleChange}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  name="password"
                  label="Password"
                  type={showPassword ? "text" : "password"} // Toggle between text and password
                  variant="standard"
                  size="small"
                  fullWidth
                  required
                  value={formData.password}
                  onChange={handleChange}
                  error={!!formErrors.password}
                  helperText={formErrors.password}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={handleClickShowPassword}
                          edge="end"
                        >
                          {showPassword ? <Visibility /> : <VisibilityOff />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  name="confirmPassword"
                  label="Confirm Password"
                  type={showConfirmPassword ? "text" : "password"} // Toggle between text and password
                  variant="standard"
                  size="small"
                  fullWidth
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  error={!!formErrors.confirmPassword}
                  helperText={formErrors.confirmPassword}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle confirm password visibility"
                          onClick={handleClickShowConfirmPassword}
                          edge="end"
                        >
                          {showConfirmPassword ? (
                            <Visibility />
                          ) : (
                            <VisibilityOff />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              {error && (
                <div className="w-full max-w-full rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                        {error}
                      </h3>
                    </div>
                  </div>
                </div>
              )}

              <Grid size={12}>
                <Button
                  variant="contained"
                  fullWidth
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Signing Up..." : "Sign Up"}
                </Button>
              </Grid>

              <Grid size={12} textAlign={"center"}>
                <Box>
                  <Typography variant="body1" color={grey[800]} mb={1}>
                    Already have an account?{" "}
                    <Link
                      to="/login"
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      Sign in
                    </Link>{" "}
                  </Typography>

                  <Typography variant="body2" color={grey[800]}>
                    By Creating your account you are agree to CheckMe&apos;s{" "}
                    <Link
                      to="/privacy_policy"
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      Privacy Policy
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="/terms"
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      Terms of Service
                    </Link>
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Box>

        {/* {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  {error}
                </h3>
              </div>
            </div>
          </div>
        )} */}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            {/* <div>
              <label htmlFor='company_name' className='sr-only'>
                Company
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center'>
                  <Building2
                    className='h-5 w-5 text-gray-400'
                    style={{ zIndex: '9' }}
                  />
                </div>
                <input
                  id='company_name'
                  name='company_name'
                  type='text'
                  required
                  className='appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm'
                  placeholder='Company Name'
                  value={formData.company_name}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div>
              <label htmlFor='website' className='sr-only'>
                Company Website
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center'>
                  <Braces
                    className='h-5 w-5 text-gray-400'
                    style={{ zIndex: '9' }}
                  />
                </div>
                <input
                  id='website'
                  name='website'
                  type='text'
                  required
                  className='appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm'
                  placeholder='Company Website'
                  value={formData.website}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div>
              <label htmlFor='country' className='sr-only'>
                Country
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center'>
                  <MapPinned
                    className='h-5 w-5 text-gray-400'
                    style={{ zIndex: '9' }}
                  />
                </div>
                <input
                  id='country'
                  name='country'
                  type='text'
                  required
                  className='appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm'
                  placeholder='Country'
                  value={formData.country}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div>
              <label htmlFor='name' className='sr-only'>
                Full name
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center'>
                  <User
                    className='h-5 w-5 text-gray-400'
                    style={{ zIndex: '9' }}
                  />
                </div>
                <input
                  id='name'
                  name='name'
                  type='text'
                  required
                  className='appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm'
                  placeholder='Full name'
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div>
              <label htmlFor='email' className='sr-only'>
                Email address
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center'>
                  <Mail
                    className='h-5 w-5 text-gray-400'
                    style={{ zIndex: '9' }}
                  />
                </div>
                <input
                  id='email'
                  name='email'
                  type='email'
                  required
                  className='appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm'
                  placeholder='Email address'
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

             <div>
              <label htmlFor="phone" className="sr-only">
                 Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <MapPinned className="h-5 w-5 text-gray-400" style={{ zIndex: '9' }} />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"  
                  className="appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Phone number" 
                  value={formData.phone} 
                  onChange={handleChange} />
              </div>
            </div>


            <div>
              <label htmlFor='password' className='sr-only'>
                Password
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center'>
                  <Lock
                    className='h-5 w-5 text-gray-400'
                    style={{ zIndex: '9' }}
                  />
                </div>
                <input
                  id='password'
                  name='password'
                  type='password'
                  required
                  className='appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm'
                  placeholder='Password'
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div>
              <label htmlFor='confirmPassword' className='sr-only'>
                Confirm password
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center'>
                  <Lock
                    className='h-5 w-5 text-gray-400'
                    style={{ zIndex: '9' }}
                  />
                </div>
                <input
                  id='confirmPassword'
                  name='confirmPassword'
                  type='password'
                  required
                  className='appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm'
                  placeholder='Confirm password'
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div> */}
          </div>

          {/* <div>
            <button
              type='submit'
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </div>

          <div className='text-center'>
            <Link
              to='/login'
              className='font-medium text-blue-600 hover:text-blue-500'
            >
              Already have an account? Sign in
            </Link>
          </div> */}
        </form>
      </Box>
    </Box>
  );
};
