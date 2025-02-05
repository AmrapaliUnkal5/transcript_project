import { Box, styled, TextField, Typography } from '@mui/material';
import React from 'react';
import Grid from '@mui/material/Grid2';
import { Facebook, Apple } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LoginHome() {
  return (
    <Box bgcolor='#f2f1ef' minHeight={'100vh'} pt={2}>
      <Box maxWidth={1180} mx={'auto'} borderRadius={4} py={2} px={3}>
        <Grid container spacing={3} >
          <Grid size={{ xs: 12, md: 7 }}>
            <Box px={5} py={2} bgcolor={'#FFF'} borderRadius={4}>
              <Typography variant='h6' mb={3}>
                Check me
              </Typography>
              <Box textAlign={'center'}>
                <StyledImage
                  src='/images/temp/chatbot-temp1.jpg'
                  sx={{ margin: 'auto', borderRadius: '16px' }}
                />
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Box
              minHeight={'100%'}
              px={5}
              py={2}
              bgcolor={'#FFF'}
              borderRadius={4}
            >
              <Typography variant='h6' mb={3} textAlign={'center'}>
                Login with Email
              </Typography>

              <Box px={2}>
                <Grid container spacing={3}>
                  <Grid size={12}>
                    <TextField
                      id='standard-basic'
                      label='Enter your email id'
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
                    <StyledImage
                      src='/images/temp/captcha.png'
                      sx={{ margin: 'auto' }}
                    />
                  </Grid>

                  <Grid size={12}>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center'>
                        <input
                          id='remember-me'
                          name='remember-me'
                          type='checkbox'
                          className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                          // checked={rememberMe}
                          //onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <label
                          htmlFor='remember-me'
                          className='ml-2 block text-sm text-gray-900 dark:text-gray-300'
                        >
                          Remember me
                        </label>
                      </div>

                      <div className='text-sm'>
                        <Link
                          to='/forgot-password'
                          className='font-medium text-blue-600 hover:text-blue-500'
                        >
                          Forgot your password?
                        </Link>
                      </div>
                    </div>
                  </Grid>
                  <Grid size={12}>
                    <div>
                      <button
                        type='submit'
                        //disabled={loading}
                        className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                          true
                            ? 'bg-blue-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                        }`}
                      >
                        Sign in
                      </button>
                    </div>
                    <Box my={3}>
                      <div className='relative'>
                        <div className='absolute inset-0 flex items-center'>
                          <div className='w-full border-t border-gray-300 dark:border-gray-700'></div>
                        </div>
                        <div className='relative flex justify-center text-sm'>
                          <span className='px-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400'>
                            Or continue with
                          </span>
                        </div>
                      </div>
                    </Box>
                    <div className='grid grid-cols-3 gap-3'>
                      <button
                        type='button'
                        //onClick={() => handleSocialLogin('google')}
                        className='w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      >
                        <svg className='w-5 h-5' viewBox='0 0 24 24'>
                          <path
                            fill='currentColor'
                            d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                          />
                          <path
                            fill='currentColor'
                            d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                          />
                          <path
                            fill='currentColor'
                            d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                          />
                          <path
                            fill='currentColor'
                            d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                          />
                        </svg>
                      </button>

                      <button
                        type='button'
                        // onClick={() => handleSocialLogin('facebook')}
                        className='w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      >
                        <Facebook className='w-5 h-5' />
                      </button>

                      <button
                        type='button'
                        // onClick={() => handleSocialLogin('apple')}
                        className='w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      >
                        <Apple className='w-5 h-5' />
                      </button>
                    </div>
                    <Box my={3}>
                        <div className='text-center'>
                        <Link
                            to='/signup'
                            className='font-medium text-blue-600 hover:text-blue-500'
                        >
                            Don't have an account? Sign up
                        </Link>
                        </div>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

const StyledImage = styled('img')(() => ({
  maxWidth: '100%',
  maxHeight: '100%',
}));
