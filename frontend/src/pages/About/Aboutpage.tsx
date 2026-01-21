import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  styled,
} from "@mui/material";
import React from "react";
import { getImagePath } from "../../utils/imagePath";

export default function AboutPage() {
  return (
    <Box
      display={"flex"}
      flexDirection={"column"}
      justifyContent={"center"}
      alignItems={"center"}
      gap={2}
      color={"#fff"}
      pt={2.5}
      sx={{ backgroundColor: "#070417" }} 
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            padding: { xs: 2, sm: 4, md: 6 },
            maxWidth: "1200px",
            mx: "auto",
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mt: [-10, -20],
              mx: 3,
              objectFit: "cover",
            }}
          >
            <StyledImage
              src={getImagePath("images/about/about.png")}
              alt="Centered Illustration"
            />
          </Box>
          <Box>
            <Typography
              variant="h3"
              fontWeight={600}
              fontSize={["24px", "40px"]}
              lineHeight={1.5}
              mb={3}
              mt={2}
              px={3}
              textTransform="none"
              textAlign="left"
              fontFamily={"'Instrument Sans', sans-serif"}
            >
              Our Mission
            </Typography>
            <Typography
              fontFamily={"'Instrument Sans', sans-serif"}
              fontSize={["16px", "20px"]}
              fontWeight={400}
              px={3}
            >
              {" "}
              Our mission is simple but bold: to democratize AI.
            </Typography>

            <Typography
              fontFamily={"'Instrument Sans', sans-serif"}
              fontSize={["16px", "20px"]}
              fontWeight={400}
              px={3}
              mt={2}
            >
              We’re building an ecosystem where creating intelligent bots is no
              longer a task for specialists, but a seamless process anyone can
              navigate. Scalable, intuitive, and deeply empowering—our platform
              puts the power of AI into your hands. With Evolra, the future of
              AI isn’t distant or out of reach. It’s right here, ready to be
              shaped by you.{" "}
            </Typography>
          </Box>

          <Grid
            container
            rowSpacing={3}
            columnSpacing={{ xs: 2, sm: 2, md: 3 }}
          >
            <Grid item sm={6}>
              <Box
                px={3}
                display="flex"
                flexDirection="column"
                justifyContent="center"
                height={"100%"}
              >
                <Typography
                  variant="h3"
                  fontWeight={600}
                  fontSize={["24px", "40px"]}
                  lineHeight={1.5}
                  mb={[3, 6]}
                  mt={[2, 10]}
                  textTransform="none"
                  textAlign="left"
                  fontFamily={"'Instrument Sans', sans-serif"}
                >
                  About us
                </Typography>
                <Typography
                  variant="h3"
                  fontWeight={400}
                  fontSize={["16px", "20px"]}
                  lineHeight={1.5}
                  mb={6}
                  textTransform="none"
                  textAlign="left"
                  fontFamily={"'Instrument Sans', sans-serif"}
                >
                  We’re redefining how businesses connect with their customers
                  by making advanced, personalized AI technology accessible to
                  all. By enabling companies to build tailored conversational AI
                  bots and agents, we help them deliver better service, unlock
                  valuable insights, and foster stronger customer relationships
                </Typography>
                <Typography
                  variant="body1"
                  fontWeight={400}
                  fontSize={["16px", "20px"]}
                  lineHeight={1.5}
                  textAlign="left"
                  fontFamily={"'Instrument Sans', sans-serif"}
                >
                  Backed by a team of AI experts and innovators, Evolra blends
                  cutting-edge technologies like machine learning and natural
                  language processing with intuitive design. The result: smart,
                  ethical, and user-centric solutions that fit seamlessly into
                  real-world business needs.
                </Typography>
              </Box>
            </Grid>
            <Grid item sm={6}>
            
              <Box
                sx={{
                  position: "relative", 
                  height: "100%",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Background Eye Image */}
                <StyledImage
                  src={getImagePath("images/about/Eye.png")}
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    borderRadius: "22px",
                  }}
                />

                {/* Overlayed Icon + Name Image */}
                <Box
                  sx={{
                    position: "absolute",
                    top: "48%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Icon */}
                  <img
                    src={getImagePath("images/about/icon.png")}
                    alt="Icon"
                    style={{ width: 60, height: 60, marginBottom: 8 }}
                  />

                  {/* Name Image */}
                  <img
                    src={getImagePath("images/about/name.png")}
                    alt="Name"
                    style={{ maxWidth: "115px" }}
                  />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}

const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
