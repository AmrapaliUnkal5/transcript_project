import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import EastOutlinedIcon from '@mui/icons-material/EastOutlined';
import ReactGA from "react-ga4";

export default function StartBuilding() {

const ClickLetsGetStart = () => {
    ReactGA.event({
      category: "Button",
      action: "Click_Let's_Get_Satrted",
      label: "GetSatrted in  Bottom Section"
    });
  }


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
        fontSize={['30px', '54px']} 
        color='#fff'
        textAlign={'center'}
        sx={{
            background: 'linear-gradient(180deg, #FFFFFF 46.63%, #959595 100%)',
            backgroundClip: 'text',
            textFillColor: 'transparent',
          }}
    >
        Start building your AI Bots
      </Typography>
      <Typography 
        variant='h5'
        fontWeight={400} 
        fontSize={['16px', '20px']} 
        color='#DDDDDD' 
        mb={3} 
        textAlign={'center'}
    >
        Build, personalize, and deploy AI-powered chatbots effortlessly
      </Typography>
      <Button
        variant='contained'
        color='primary'
        size='large'
        href='/signup'
        onClick={ClickLetsGetStart}
        endIcon={<EastOutlinedIcon />}
        sx={{
          fontSize: '18px',
          fontWeight: 600,
          borderRadius: '40px',
          height: ['42px','62px'],
          minWidth: ['194px','220px'],
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
