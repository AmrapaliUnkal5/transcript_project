import { Box, Button, Container, Grid, Typography, styled } from '@mui/material';
import React from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function BotDataControl() {
  return (
    <>
      <Box
        display={'flex'}
        flexDirection={'column'}
        justifyContent={'center'}
        alignItems={'center'}
        gap={2}
        color={'#fff'}
        px={2}
        py={5}
        sx={{ backgroundColor: '#101035' }}
      >
        <Container maxWidth='lg'>
          <Box
            px={[1, 10]}
            py={[2, 10]}
            sx={{
              backgroundImage: 'url(/images/title-bg.png)',
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
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
              textAlign={'center'}
            >
              Your Bot. Your Data. Your Control
            </Typography>
          </Box>

          <Box>
            <Grid
              container
              rowSpacing={3}
              columnSpacing={{ xs: 2, sm: 2, md: 3 }}
            >
              <Grid item sm={6}>
                <Typography
                  variant='h3'
                  fontWeight={600}
                  fontSize={['18px', '30px']}
                  mb={2}
                >
                  Create Smart Bots in Minutes
                </Typography>
                <Typography variant='body1' color={'#cacaca'}>
                  Evolra lets you create powerful AI bots and agents trained
                  directly on your website content, PDFs, videos, knowledge
                  bases, and more. We take care of the complex AI processes
                  behind the scenes, allowing you to focusing on tailoring your
                  bot.
                </Typography>
                <Box display={'flex'} gap={1} my={2}>
                    <CheckCircleIcon sx={{color : '#BAB8FF'}}/>
                    <Typography variant='body1' color={'#cacaca'}>
                        Train on your data
                    </Typography>
                </Box>
                <Box display={'flex'} gap={1} my={2}>
                    <CheckCircleIcon sx={{color : '#BAB8FF'}}/>
                    <Typography variant='body1' color={'#cacaca'}>
                        Consistent branding matching your brand 
                    </Typography>
                </Box>
                <Box display={'flex'} gap={1} my={2}>
                    <CheckCircleIcon sx={{color : '#BAB8FF'}}/>
                    <Typography variant='body1' color={'#cacaca'}>
                        Custom integration with your system
                    </Typography>
                </Box>
                <Box display={'flex'} gap={1} my={2}>
                    <CheckCircleIcon sx={{color : '#BAB8FF'}}/>
                    <Typography variant='body1' color={'#cacaca'}>
                    AI-powered bots for internal teams
                    </Typography>
                </Box>
                
                
              </Grid>
              <Grid item sm={6}>
                 <StyledImage src='/images/bot-data.png' sx={{ margin: 'auto'}} />
              </Grid>
            </Grid>
          </Box>
          <Box display={'flex'} justifyContent={'center'} my={2}>
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
        </Container>
      </Box>
    </>
  );
}


const StyledImage = styled('img')(() => ({
    maxWidth: '100%',
    maxHeight: '100%',
  }));
