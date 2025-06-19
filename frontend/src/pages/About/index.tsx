
import React from 'react';
import { Box, Fab, styled, } from '@mui/material';
import Footer from '../../components/Footer/Footer';
import HomeHeader from '../../components/Header/Header';
import StartBuilding from '../Home/StartBuilding';
import AboutPage from './Aboutpage';
import Bottom from './Bottom';
import Top from './Top';




export default function About() {
  return (
    <Box>
      <HomeHeader/> 
      <Top/> 
      <AboutPage/>   
      <Bottom/>
      <Footer/> 
    </Box>
  );
}
