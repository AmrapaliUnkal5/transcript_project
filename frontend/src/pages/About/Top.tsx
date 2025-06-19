
import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import EastOutlinedIcon from '@mui/icons-material/EastOutlined';

export default function Top() {
  return (
    
    <Box 
        px={2} py={[4]} display='flex' 
        flexDirection='column' alignItems='center' 
        justifyContent='center'
        gap={3}
        maxHeight={[443]}
        sx={{ 
            backgroundImage: 'url(/images/home/bg-start-building.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: "linear-gradient(120deg, #0B0F32 0%, #3D49D5 100%)"
        }} 
        
        >
   <Box sx={{ padding: { xs: 2, sm: 4, md: 6 }, maxWidth: "1200px", mx: "auto" }}>
          
            <Box
          px={[1, 10]}
          pt={[4,10]}
          pb={[2,8]}
          sx={{
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <Typography
            variant="h2"
            fontWeight={600}
            fontSize={["25px","30px", "60px"]}
            sx={{
              background: "-webkit-linear-gradient(#FFF, #959595)",
              backgroundClip: "text",
              textFillColor: "transparent",
            }}
            textAlign={"center"}
            mb={[4, 0]}
          >
           Simplifying AI, Amplifying Possibilities
          </Typography></Box>
          </Box>
   
     
    </Box>
  );
}

