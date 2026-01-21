import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  styled,
} from "@mui/material";
import React from "react";
import { getBackgroundImageUrl } from "../../utils/imagePath";

export default function Top() {
  return (
    <Box
      display={"flex"}
      flexDirection={"column"}
      justifyContent={"center"}
      alignItems={"center"}
      gap={2}
      color={"#fff"}
      pt={[5,2.5]}
      sx={{ backgroundColor: "#070417" }}
    >
      <Container maxWidth="lg">

        <Box
          px={[1, 10]}
          pt={[5,10]}
          pb={[0,8]}
          sx={{
            backgroundImage: getBackgroundImageUrl("images/our-service-bg.png"),
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",  
            width:"100%",       
          }}
        >

     <Box sx={{ padding: { xs: 2, sm: 4, md: 6 }, maxWidth: "1200px", mx: "auto" }}>      <Typography
            variant="h2"
            fontWeight={600}
            fontSize={["30px", "60px"]}
            sx={{
              background: "-webkit-linear-gradient(#FFF, #959595)",
              backgroundClip: "text",
              textFillColor: "transparent",
            }}
            textAlign={"center"}
            mb={[4, 0]}
          >
           Our Services
          </Typography>
          </Box></Box>
          
       
        
      </Container>
    </Box>
  );
}

const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
