import { Box, Fab, styled, } from '@mui/material';
import React from 'react';
import Footer from '../../components/Footer/Footer';
import HomeHeader from '../../components/Header/Header';
import MoreFaq from './MoreFaq';
import StartBuilding from '../Home/StartBuilding';




export default function FAQPage() {
  return (
    <Box>
    <HomeHeader/>
    <MoreFaq/>
    <StartBuilding/>
    <Footer/> 

      
    </Box>
  );
}
