import React from 'react';
import { Box, Button, Typography } from '@mui/material';

export default function Hero() {
  return (
    <>
      <Box
        mt={'50px'}
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
          minHeight={'80vh'}
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
            <Typography
              variant='h2'
              fontWeight={600}
              fontSize={['32px', '60px']}
              sx={{
                background: '-webkit-linear-gradient(#FFF, #959595)',
                backgroundClip: 'text',
                textFillColor: 'transparent',
              }}
            >
              Create Custom AI Agents.
            </Typography>
            <Box
              display={'flex'}
              flexWrap={'wrap'}
                justifyContent={'center'}
                alignItems={'center'}
               gap={[1, 2]}
            >
              <Typography
                variant='h3'
                fontWeight={600}
                fontSize={['28px', '56px']}
                sx={{
                  background: '-webkit-linear-gradient(#FFF, #959595)',
                  backgroundClip: 'text',
                  textFillColor: 'transparent',
                }}
              >
                Train on your{' '}
              </Typography>

              <Typography
                variant='h3'
                color={'#779BFD'}
                fontWeight={600}
                fontSize={['28px', '56px']}
              >
                website content
              </Typography>
            </Box>
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
                background:
                  'linear-gradient(180deg,rgba(90, 108, 242, 1) 0%, rgba(75, 52, 152, 1) 100%);',
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
