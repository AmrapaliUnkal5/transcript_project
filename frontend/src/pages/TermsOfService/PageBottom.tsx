import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import EastOutlinedIcon from '@mui/icons-material/EastOutlined';

export default function PageBottom() {
  return (
    <Box 
        px={2} py={4} display='flex' 
        flexDirection='column' alignItems='center' 
        justifyContent='center'
        gap={3}
        maxHeight={[443]}
        minHeight={[400,]}
        sx={{ 
            backgroundImage: 'linear-gradient(180deg, #101035 0%, #0D0A1F 50%, #070417 100%)',

            backgroundSize: 'cover',
            backgroundPosition: 'center',
            }} 
        
        >
      <Typography 
        variant='h2' 
        fontWeight={600} 
        fontSize={['30px', '54px']} 
        color='#fff'
        textAlign={'center'}
        sx={{
            background: 'linear-gradient(180deg, #FFFFFF 46.63%, #959595 100%)',
            backgroundClip: 'text',
            textFillColor: 'transparent',
          }}
    >
        Let’s Get In Touch
      </Typography>
      <Typography 
        variant='h5'
        fontWeight={400} 
        fontSize={['16px', '20px']} 
        color='#DDDDDD' 
        mb={3} 
        textAlign={'center'}
    >
        And explore the possibilities to supercharge your business with AI
      </Typography>
      <Button
        variant='contained'
        color='primary'
        size='large'
        href='/signup'
        sx={{
          fontSize: '18px',
          fontWeight: 600,
          borderRadius: '40px',
          height: ['42px','62px'],
          minWidth: ['194px','215px'],
          textTransform: 'capitalize',
          borderColor: '#F4F4F6',
          color: '#363636',
          background: 'linear-gradient(180deg, #F4F4F6 0%, #7C7C7C 100%)',
        }}
      >
         Connect with us
      </Button>
    </Box>
  );
}
