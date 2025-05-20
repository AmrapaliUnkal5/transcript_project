import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import EastOutlinedIcon from '@mui/icons-material/EastOutlined';

export default function StartBuilding() {
  return (
    <Box 
        px={2} py={4} display='flex' 
        flexDirection='column' alignItems='center' 
        justifyContent='center'
        gap={3}
        minHeight={[400, 600]}
        sx={{ 
            backgroundImage: 'url(/images/home/bg-start-building.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor:'#262372'
        }} 
        
        >
      <Typography 
        variant='h2' 
        fontWeight={600} 
        fontSize={['32px', '60px']} 
        color='#fff'
        textAlign={'center'}
        sx={{
            background: 'linear-gradient(180deg, #FFFFFF 46.63%, #959595 100%)',
            backgroundClip: 'text',
            textFillColor: 'transparent',
          }}
    >
        Start building your AI agents
      </Typography>
      <Typography 
        variant='h5'
        fontWeight={400} 
        fontSize={['16px', '20px']} 
        color='#DDDDDD' 
        mb={4} 
        textAlign={'center'}
    >
        Build, personalize, and deploy AI-powered chatbots effortlessly
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
          height: '62px',
          minWidth: '220px',
          textTransform: 'capitalize',
          borderColor: '#F4F4F6',
          color: '#363636',
          background: 'linear-gradient(180deg, #F4F4F6 0%, #7C7C7C 100%)',
        }}
      >
         Let&apos;s get started 
      </Button>
    </Box>
  );
}
