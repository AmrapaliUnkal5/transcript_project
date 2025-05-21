import { Box, Fab, styled, } from '@mui/material';
import React from 'react';
import Footer from '../../components/Footer/Footer';
import HomeHeader from '../../components/Header/Header';
import FAQ from './FAQ';
import ConversationForm from './ConversationForm';
import StartBuilding from '../Home/StartBuilding';



export default function ContactUs() {
  return (
    <Box>
    <HomeHeader/>
    <ConversationForm/>
     
    <FAQ/>
    <StartBuilding/>
    <Footer/> 
    </Box>
  );
}
