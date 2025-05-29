import { Box, styled, } from '@mui/material';
import React from 'react';

import HomeHeader from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { DataDeletionPolicy } from './DataDeletionPolicy';



export default function DataDeletion() {
    return (
        <Box>
        <HomeHeader/>
        <DataDeletionPolicy/>
        <Footer/> 
        </Box>
    );
}