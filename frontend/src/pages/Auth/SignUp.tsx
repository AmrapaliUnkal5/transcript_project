import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Building2, Braces, MapPinned } from 'lucide-react';
import { authApi, type SignUpData } from '../../services/api';
import { Box, Button, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import GoogleIcon from '@mui/icons-material/Google';
import AppleIcon from '@mui/icons-material/Apple';
import FacebookIcon from '@mui/icons-material/Facebook';
import { grey } from '@mui/material/colors';

export const SignUp = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    website: '',
    country: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const signupData: SignUpData = {
        company_name: formData.company_name,
        website: formData.website,
        country: formData.country,
        name: formData.name,
        email: formData.email,
        password: formData.password,
      };

      await authApi.signup(signupData);
      navigate('/login', {
        state: { message: 'Account created successfully! Please login.' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      bgcolor='#f2f1ef'
      className='min-h-screen dark:bg-gray-900 flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8'
    >
      <Box className='max-w-lg w-full space-y-8'>
        <Box bgcolor={'#FFF'} borderRadius={4} py={2} px={3}>
          <Typography variant='h6' mb={3} textAlign={'center'}>
            Sign Up
          </Typography>


          <Box>
            {/* <Typography variant='body1' color={grey[800]} mb={1}>Continue with:</Typography> */}

            <Grid container spacing={2}>
              <Grid size={4}>
                <Box
                  display={'flex'}
                  justifyContent={'center'}
                  gap={2}
                  p={2}
                  borderRadius={'12px'}
                  boxShadow={'0px 2px 30px 2px rgba(0, 0, 0, 0.08);'}
                  mb={'12px'}
                  sx={{cursor:'pointer'}}
                >
                  <GoogleIcon />
                  <Typography variant='body1' color={grey[800]}>
                    Google
                  </Typography>
                </Box>
              </Grid>

              <Grid size={4}>
                <Box
                    display={'flex'}
                    justifyContent={'center'}
                    gap={2}
                    p={2}
                    borderRadius={'12px'}
                    boxShadow={'0px 2px 30px 2px rgba(0, 0, 0, 0.08);'}
                    mb={'12px'}
                    sx={{cursor:'pointer'}}
                  >
                    <AppleIcon />
                    <Typography variant='body1' color={grey[800]}>
                      Apple
                    </Typography>
                  </Box>
              </Grid>
              <Grid size={4}>
                <Box
                    display={'flex'}
                    justifyContent={'center'}
                    gap={2}
                    p={2}
                    borderRadius={'12px'}
                    boxShadow={'0px 2px 30px 2px rgba(0, 0, 0, 0.08);'}
                    mb={'12px'}
                    sx={{cursor:'pointer'}}
                  >
                    <FacebookIcon />
                    <Typography variant='body1' color={grey[800]}>
                      Facebook
                    </Typography>
                  </Box>
              </Grid>
            </Grid>
            
          </Box>

          <Typography
            variant='body1'
            textAlign={'center'}
            mt={2}
            color='grey.600'
          >
            or
          </Typography>

          <Box>
            <Grid container spacing={3}>
              <Grid size={6}>
                <TextField
                  id='standard-basic'
                  label='First Name'
                  variant='standard'
                  size='small'
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  id='standard-basic'
                  label='Last Name'
                  variant='standard'
                  size='small'
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  id='standard-basic'
                  label='Company Name'
                  variant='standard'
                  size='small'
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  id='standard-basic'
                  label='Contact No.'
                  variant='standard'
                  size='small'
                  fullWidth
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  id='standard-basic'
                  label='Email'
                  variant='standard'
                  size='small'
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  id='standard-basic'
                  label='Password'
                  type='password'
                  variant='standard'
                  size='small'
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  id='standard-basic'
                  label='Confirm Password'
                  type='password'
                  variant='standard'
                  size='small'
                  fullWidth
                  required
                />
              </Grid>

              <Grid size={12}>
                <Button variant='contained' fullWidth>
                  Sign Up
                </Button>
              </Grid>

              <Grid size={12} textAlign={'center'}>
                <Box>
                  <Typography variant='body1' color={grey[800]} mb={1}>
                    Already have an account?{' '}
                    <Link
                      to='/login'
                      className='font-medium text-blue-600 hover:text-blue-500'
                    >
                      Sign in
                    </Link>{' '}
                  </Typography>

                  <Typography variant='body2' color={grey[800]}>
                    By Creating your account you are agree to CheckMe&apos;s{' '}
                    <Link
                      to='#'
                      className='font-medium text-blue-600 hover:text-blue-500'
                    >
                      Privacy Policy
                    </Link>{' '} and  <Link
                      to='#'
                      className='font-medium text-blue-600 hover:text-blue-500'
                    >
                      Terms of Service
                    </Link>
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Box>

        {error && (
          <div className='rounded-md bg-red-50 dark:bg-red-900/20 p-4'>
            <div className='flex'>
              <div className='ml-3'>
                <h3 className='text-sm font-medium text-red-800 dark:text-red-200'>
                  {error}
                </h3>
              </div>
            </div>
          </div>
        )}

        <form className='mt-8 space-y-6' onSubmit={handleSubmit}>
          <div className='rounded-md shadow-sm -space-y-px'>
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
