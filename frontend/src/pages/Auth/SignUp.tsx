import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
//import { User, Mail, Lock, Building2, Braces, MapPinned } from "lucide-react";
import { authApi, type SignUpData } from "../../services/api";
import { Box, Button, TextField, Typography, styled } from "@mui/material";
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
  

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

 
  const handleClickShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

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

     
      if (name === "confirmPassword") {
        setIsConfirmPasswordTouched(true);
      }

     
      validateField(name, value, updatedForm);

      return updatedForm;
    });

   
    if (error) setError(null);
  };

  useEffect(() => {
    
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
   
    if (response.credential) {
      try {
        const res = await authApi.googleLogin(response.credential);
      
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
            theme: "outline", 
            size: "large", 
            shape: "pill", 
            text: "none", 
            logo_alignment: "center", 
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
    
    Object.keys(formData).forEach((fieldName) => {
      validateField(fieldName, formData[fieldName as keyof typeof formData]);
      if (formErrors[fieldName as keyof typeof formErrors]) {
        isValid = false;
      }
    });

    return isValid;
  };


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
    <DarkGBox
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
        <LightGBox bgcolor={"#FFF"} borderRadius={4} py={2} px={3}>
          <Typography variant="h6" mb={3} textAlign={"center"}>
            Sign Up
          </Typography>

          <Box>
       

            <Grid container spacing={2} justifyContent="center">
              <Grid size={5}>
                <Box sx={{ cursor: "pointer", width: "100%" }}>
                  <div id="g_signin" style={{ width: "100%" }}></div>
                </Box>
              </Grid>
             
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
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      Privacy Policy
                    </a>{" "}
                    and{" "}
                    <a
                      href="/terms-of-service"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      Terms of Service
                    </a>
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </form>
        </LightGBox>

        

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            
          </div>
        </form>
      </Box>
    </DarkGBox>
  );
};



const LightGBox = styled(Box)(() => ({
  background: "linear-gradient(108.14deg, rgb(242, 246, 249) 0%, rgb(233, 243, 247) 9.47%, rgb(226, 240, 247) 20.52%, rgb(219, 235, 247) 36.84%, rgb(211, 225, 247) 51.58%, rgb(213, 222, 247) 68.94%, rgb(219, 221, 242) 83.15%, rgb(221, 220, 240) 101.05%);",
}));

const DarkGBox = styled(Box)(() => ({
  background: 'linear-gradient(180deg, #000 0%, #181e4a 35%, #000 100%)',
}));