import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  styled,
} from "@mui/material";
import React from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export default function KeyBenefits() {
  return (
    <>
      <Box
        display={"flex"}
        flexDirection={"column"}
        justifyContent={"center"}
        alignItems={"center"}
        gap={2}
        color={"#fff"}
        px={2}
        py={5}
        sx={{ backgroundColor: "#101035" }}
      >
        <Container maxWidth="lg">
          <Box
            px={[1, 10]}
            py={[2, 10]}
            sx={{
              backgroundImage: "url(/images/title-bg.png)",
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <Typography
              variant="h2"
              fontWeight={600}
              fontSize={["30px", "54px"]}
              sx={{
                background: "-webkit-linear-gradient(#FFF, #959595)",
                backgroundClip: "text",
                textFillColor: "transparent",
              }}
              textAlign={"center"}
            >
              Key Benefits of Evolra
            </Typography>
          </Box>

          <Box>
            <Grid
              container
              rowSpacing={3}
              columnSpacing={{ xs: 2, sm: 2, md: 3 }}
            >
              <Grid item sm={6}>
                <Box
                  px={3}
                  pt={"68px"}
                  pb={"34px"}
                  border={"solid 1px #8B96D661"}
                  borderRadius={3}
                  sx={{
                    background:
                      "linear-gradient(115.95deg, rgba(84, 71, 157, 0.42) 10.92%, rgba(71, 53, 144, 0.056) 96.4%)",
                  }}
                >
                  <StyledImage
                    src="/images/home/key-video.png"
                    sx={{
                      margin: "auto",
                      maxWidth: 347,
                      maxHeight: 210,
                      marginBottom: "65px",
                    }}
                  />
                  <Typography
                    variant="h3"
                    fontWeight={600}
                    fontSize={["18px", "24px"]}
                    lineHeight={1.5}
                    mb={2}
                    textTransform="none"
                  >
                    Turn YouTube Videos into Knowledge Base
                  </Typography>
                  <Typography variant="body1" color={"#9F9F9F"}>
                    Effortlessly transform your YouTube video content into a
                    powerful resource, enabling AI bot to answer customer
                    questions directly from your videos.
                  </Typography>
                </Box>
              </Grid>
              <Grid item sm={6}>
                <Box
                  px={3}
                  pt={"68px"}
                  pb={"34px"}
                  border={"solid 1px #8B96D661"}
                  borderRadius={3}
                  sx={{
                    background:
                      "linear-gradient(115.95deg, rgba(84, 71, 157, 0.42) 10.92%, rgba(71, 53, 144, 0.056) 96.4%)",
                  }}
                >
                  <StyledImage
                    src="/images/home/key-support.png"
                    sx={{
                      margin: "auto",
                      maxWidth: 337,
                      maxHeight: 210,
                      marginBottom: "65px",
                    }}
                  />
                  <Typography
                    variant="h3"
                    fontWeight={600}
                    fontSize={["18px", "24px"]}
                    lineHeight={1.5}
                    mb={2}
                    textTransform="none"
                  >
                    Multilingual Support
                  </Typography>
                  <Typography variant="body1" color={"#9F9F9F"}>
                    Expand your global reach by serving customers in their preferred language. The bot accurately understands and responds in multiple languages, making support seamless for diverse audiences.
                  </Typography>
                </Box>
              </Grid>
              <Grid item sm={4}>
                <Box
                  px={3}
                  pt={"68px"}
                  pb={"34px"}
                  minHeight={510}
                  border={"solid 1px #8B96D661"}
                  borderRadius={3}
                  sx={{
                    background:
                      "linear-gradient(115.95deg, rgba(84, 71, 157, 0.42) 10.92%, rgba(71, 53, 144, 0.056) 96.4%)",
                  }}
                >
                  <Box height={175} mb={"65px"}>
                    <StyledImage
                      src="/images/home/key-chat.png"
                      sx={{ margin: "auto", maxWidth: 275, maxHeight: 190 }}
                    />
                  </Box>
                  <Typography
                    variant="h3"
                    fontWeight={600}
                    fontSize={["18px", "24px"]}
                    lineHeight={1.5}
                    mb={2}
                    textTransform="none"
                  >
                    AI That Speaks Human
                  </Typography>
                  <Typography variant="body1" color={"#9F9F9F"}>
                    Experience seamless communication with your smart bot
                    designed to listen, understand, and respond just like a real
                    person.
                  </Typography>
                </Box>
              </Grid>
              <Grid item sm={4}>
                <Box
                  px={3}
                  pt={"68px"}
                  pb={"34px"}
                  minHeight={510}
                  border={"solid 1px #8B96D661"}
                  borderRadius={3}
                  sx={{
                    background:
                      "linear-gradient(115.95deg, rgba(84, 71, 157, 0.42) 10.92%, rgba(71, 53, 144, 0.056) 96.4%)",
                  }}
                >
                  <Box height={175} mb={"65px"}>
                    <StyledImage
                      src="/images/home/key-website.png"
                      sx={{ margin: "auto", maxWidth: 289, maxHeight: 190 }}
                    />
                  </Box>
                  <Typography
                    variant="h3"
                    fontWeight={600}
                    fontSize={["18px", "24px"]}
                    lineHeight={1.5}
                    mb={2}
                    textTransform="none"
                  >
                    1 Click Website Integration
                  </Typography>
                  <Typography variant="body1" color={"#9F9F9F"}>
                    Easily integrate the bot into your website with a simple
                    code snippet—ready in minutes
                  </Typography>
                </Box>
              </Grid>
              <Grid item sm={4}>
                <Box
                  px={3}
                  pt={"68px"}
                  pb={"34px"}
                  minHeight={510}
                  border={"solid 1px #8B96D661"}
                  borderRadius={3}
                  sx={{
                    background:
                      "linear-gradient(115.95deg, rgba(84, 71, 157, 0.42) 10.92%, rgba(71, 53, 144, 0.056) 96.4%)",
                  }}
                >
                  <Box
                    height={175}
                    display={"flex"}
                    alignItems={"center"}
                    mb={"65px"}
                  >
                    <StyledImage
                      src="/images/home/key-analytics.png"
                      sx={{ margin: "auto", maxWidth: 257, maxHeight: 190 }}
                    />
                  </Box>
                  <Typography
                    variant="h3"
                    fontWeight={600}
                    fontSize={["18px", "24px"]}
                    lineHeight={1.5}
                    mb={2}
                    textTransform="none"
                  >
                    Insightful Analytics
                  </Typography>
                  <Typography variant="body1" color={"#9F9F9F"}>
                    Explore rich analytics that deliver insights beyond basic
                    metric – highlighting trends, behaviors and opportunities
                    you can act on instantly.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
          <Box mt={4} mb={[4,8.5]}>
            <Typography
              variant="h6"
              color="#AFAFAF"
              fontWeight={400}
              textAlign={"center"}
              maxWidth={930}
              fontSize={["14px", "20px"]}
              mx={"auto"}
              textTransform="none"
            >
              Our intuitive self-service platform empowers you to create
              sophisticated bots and agents that truly represent your brand's
              unique image, all while adapting intelligently to your evolving
              business needs.
            </Typography>
          </Box>
          <Box display={"flex"} justifyContent={"center"} mb={[0,2]} mt={1}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              sx={{
                fontSize: "18px",
                fontWeight: 500,
                borderRadius: "40px",
                height: ["52px","62px"],
                minWidth: ["180px","220px"],
                textTransform: "capitalize",
                background:
                  "linear-gradient(180deg,rgba(90, 108, 242, 1) 0%, rgba(75, 52, 152, 1) 100%);",
              }}
            >
              Try Evolra Now
            </Button>
          </Box>
        </Container>
      </Box>
    </>
  );
}

const StyledImage = styled("img")(() => ({
  width: "100%",
  maxHeight: "100%",
}));
