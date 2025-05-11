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
            backgroundImage: 'url(/images/start-bg.jpg)',
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
            background: '-webkit-linear-gradient(#FFF, #959595)',
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
        variant='outlined'
        color='primary'
        size='large'
        sx={{
          fontSize: '18px',
          fontWeight: 500,
          borderRadius: '40px',
          height: '62px',
          minWidth: '220px',
          textTransform: 'capitalize',
          borderColor: '#F4F4F6',
          color: '#F4F4F6',
        }}
      >
         Let’s get started <EastOutlinedIcon sx={{marginLeft: '10px'}}/>
      </Button>
    </Box>
  );
}
