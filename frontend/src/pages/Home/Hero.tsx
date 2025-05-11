import React from 'react';
import { Box, Button, Typography } from '@mui/material';

export default function Hero() {
  return (
    <>
      <Box
        minHeight={'100vh'}
        sx={{
          backgroundImage: 'url(/images/dot-bg.png)',
          backgroundPosition: 'center',
          backgroundColor: '#101035',
        }}
      >
        <Box
          display='flex'
          flexDirection='column'
          justifyContent='center'
          alignItems='center'
          sx={{
            backgroundImage: 'url(/images/hero-bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
          minHeight={'100vh'}
        >
          <Box
            display={'flex'}
            flexDirection={'column'}
            justifyContent={'center'}
            alignItems={'center'}
            gap={2}
            textAlign={'center'}
            color={'#fff'}
            px={2}
          >
            <Typography variant='h2' fontWeight={600} fontSize={['32px', '60px']}>
              Create Custom AI Agents.
            </Typography>
            <Typography variant='h3' fontWeight={600} fontSize={['28px', '56px']}>
              Train on your {' '}
              <span style={{ color: '#779BFD' }}> {' '} website content</span>
            </Typography>
            <Typography variant='h6' color='#B4B4B4' mt={2} mb={3}>
              Build, personalize, and deploy AI-powered chatbots effortlessly
            </Typography>
            <Button
              variant='contained'
              color='primary'
              size='large'
              sx={{
                fontSize: '18px',
                fontWeight: 500,
                borderRadius: '40px',
                height: '62px',
                minWidth: '220px',
                textTransform: 'capitalize',
              }}
            >
              Get started for free
            </Button>
          </Box>
        </Box>
      </Box>
    </>
  );
}
