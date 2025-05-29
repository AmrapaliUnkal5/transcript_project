import { Box, styled, } from '@mui/material';
import React from 'react';
import HomeHeader from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { TermsOfService } from './TermsOfService';



export default function TermsService() {
    return (
        <Box>
        <HomeHeader/>
        <TermsOfService/>
        <Footer/> 
        </Box>
    );
}