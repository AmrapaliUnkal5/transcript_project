import { Box, styled } from '@mui/material';
import React from 'react';

export default function DashboardPreview() {
  return (
    <Box 
        px={2}
        sx={{
        backgroundImage: 'url(/images/dot-bg.png)',
        backgroundPosition: 'center',
        backgroundColor: '#101035',
      }}>
        <StyledImage src='/images/dashboard-view.jpg' sx={{ margin: 'auto'}} />

    </Box>
  )
}

const StyledImage = styled('img')(() => ({
    maxWidth: '100%',
    maxHeight: '100%',
  }));