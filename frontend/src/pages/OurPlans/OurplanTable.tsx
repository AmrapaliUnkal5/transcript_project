import React from "react";
import { Box, Button, Typography } from "@mui/material";
import Typical from "react-typical";
import Divider from "@mui/material/Divider";
import { useEffect } from "react";
import { useSubscriptionPlans } from "../../context/SubscriptionPlanContext";

import { styled } from "@mui/material/styles";
import { getImagePath } from "../../utils/imagePath";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
export const OurplanTable = () => {
  const { plans } = useSubscriptionPlans();
  
  // Get plans by name for dynamic pricing
  const starterPlan = plans.find(plan => plan.name === "Starter");
  const growthPlan = plans.find(plan => plan.name === "Growth");
  const professionalPlan = plans.find(plan => plan.name === "Professional");
  
  // Format price helper
  const formatPrice = (price: number | string | null | undefined) => {
    if (price === null || price === undefined) return "0";
    if (typeof price === "string" && price.toLowerCase() === "custom") return "Custom";
    return Number(price).toFixed(2);
  };

  useEffect(() => {    //Using this use effect so that the page direct scrolls there once user clicks required button
  const hash = window.location.hash;

  if (hash) {
    const el = document.querySelector(hash);
    if (el) {
      
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth" });
      }, 100); 
    }
  }
}, []);


  return (
    <Box
    id="plans-table"
      sx={{
        backgroundPosition: "center",
        backgroundColor: "#101035",
      }}
    >
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
      >
        <Box
          display={"flex"}
          flexDirection={"column"}
          justifyContent={"center"}
          alignItems={"center"}
          textAlign={"center"}
          color={"#fff"}
          py={5}
        >
          <>
            <Typography
              variant="h2"
              fontWeight={600}
              fontSize={["30px", "40px", "40px"]}
              lineHeight={["44px", "40px"]}
              mt={["46px", "87px"]}
              sx={{
                mt: "66px",
                background: "-webkit-linear-gradient(#FFF, #959595)",
                backgroundClip: "text",
                textFillColor: "transparent",
                textAlign: "center",
              }}
            >
              Compare All Features And Plans
            </Typography>
          </>
        </Box>
      </Box>
      <Box>
        <Box px={10} py={5} display={["none", "block"]}>
          <TableContainer
            sx={{
              backgroundPosition: "center",
              backgroundColor: "#101035",
              borderBottom: "none",
              "& td, & th": {
                borderBottom: "none",
                color: "white", 
              },
            }}
          >
            <Table
              

              sx={{
                borderCollapse: "separate",
                borderSpacing: "16px 16px", 
                "& td, & th": {
                  textAlign: "center", 
                  verticalAlign: "middle",
                  padding: "20px 14px",
                },
                
                "& td:first-of-type, & th:first-of-type": {
                  textAlign: "left",
                  paddingLeft: 0, 
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontSize: "18px",
                      fontWeight: 600,
                      lineHeight: "32px",
                      color: "white",
                    }}
                  ></TableCell>
                  <TableCell
                    sx={{
                      fontSize: "18px",
                      fontWeight: 600,
                      lineHeight: "32px",
                      color: "white",
                    }}
                  >
                    Free
                  </TableCell>
                  <TableCell
                    sx={{
                      fontSize: "18px",
                      fontWeight: 600,
                      lineHeight: "32px",
                      color: "white",
                    }}
                  >
                    Starter
                  </TableCell>
                  <TableCell
                    sx={{
                      fontSize: "18px",
                      fontWeight: 600,
                      lineHeight: "32px",
                      color: "white",
                    }}
                  >
                    Growth
                  </TableCell>
                  <TableCell
                    sx={{
                      fontSize: "18px",
                      fontWeight: 600,
                      lineHeight: "32px",
                      color: "white",
                    }}
                  >
                    Professional
                  </TableCell>
                  <TableCell
                    sx={{
                      fontSize: "18px",
                      fontWeight: 600,
                      lineHeight: "32px",
                      color: "white",
                    }}
                  >
                    Enterprise
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontSize: "20px", fontWeight: 600 }}>
                    Features
                  </TableCell>
                  <TableCell>
                    <Box display="flex" justifyContent="center" my={0}>
                      <Button
                        variant="text"
                        href="/signup"
                        sx={{
                          width: "137px",
                          height: "40px",

                          gap: "6px",
                          backgroundColor: "transparent",

                          color: "inherit",
                          border: "1px solid", 
                          borderColor: "currentColor", 
                          borderRadius: "40px",
                          textTransform: "none",
                        }}
                      >
                        Get started
                      </Button>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" justifyContent="center" my={0}>
                      <Button
                        variant="text"
                        href="/signup"
                        sx={{
                          width: "137px",
                          height: "40px",

                          gap: "6px",
                          backgroundColor: "transparent",

                          color: "inherit",
                          border: "1px solid", 
                          borderColor: "currentColor", 
                          borderRadius: "40px",
                          textTransform: "none",
                        }}
                      >
                        Choose plan
                      </Button>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {" "}
                    <Box display="flex" justifyContent="center" my={0}>
                      <Button
                        variant="text"
                        href="/signup"
                        sx={{
                          width: "137px",
                          height: "40px",

                          gap: "6px",
                          backgroundColor: "transparent",

                          color: "inherit",
                          border: "1px solid", 
                          borderColor: "currentColor", 
                          borderRadius: "40px",
                          textTransform: "none",
                        }}
                      >
                        Choose plan
                      </Button>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {" "}
                    <Box display="flex" justifyContent="center" my={0}>
                      <Button
                        variant="text"
                        href="/signup"
                        sx={{
                          width: "137px",
                          height: "40px",

                          gap: "6px",
                          backgroundColor: "transparent",

                          color: "inherit",
                          border: "1px solid", 
                          borderColor: "currentColor", 
                          borderRadius: "40px",
                          textTransform: "none",
                        }}
                      >
                        Choose plan
                      </Button>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {" "}
                    <Box display="flex" justifyContent="center" my={0}>
                      <Button
                        variant="text"
                        href="/signup"
                        sx={{
                          width: "137px",
                          height: "40px",

                          gap: "6px",
                          backgroundColor: "transparent",

                          color: "inherit",
                          border: "1px solid", 
                          borderColor: "currentColor", 
                          borderRadius: "40px",
                          textTransform: "none",
                        }}
                      >
                        Choose plan
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell
                    align="left"
                    sx={{ fontSize: "16px", fontWeight: 400 }}
                  >
                    Price
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    $0
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    $25
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    $45
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    $80
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    Custom price
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    Chatbots
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    1
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    1
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    2
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    5
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    Custom
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    Word Count
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    50k
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    1 million
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    2 million
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    5 million
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    Custom
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    Storage
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    20 MB
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    500 MB
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    1 GB
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    5 GB
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    Custom
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    Website Crawling
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    1 website
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    1 website
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    2 website
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    multiple
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    multiple
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    YouTube Grounding
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    <Box display="flex" justifyContent="center">
                      <StyledImage
                        src={getImagePath("images/icons/icon-cancel.png")} 
                        sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    <Box display="flex" justifyContent="center">
                      <StyledImage
                        src={getImagePath("images/icons/icon-cancel.png")} 
                        sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    <Box display="flex" justifyContent="center">
                      <StyledImage
                        src={getImagePath("images/icons/icon-check.png")} 
                        sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    {" "}
                    <Box display="flex" justifyContent="center">
                      <StyledImage
                        src={getImagePath("images/icons/icon-check.png")} 
                        sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                    {" "}
                    <Box display="flex" justifyContent="center">
                      <StyledImage
                        src={getImagePath("images/icons/icon-check.png")} 
                        sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                      />
                    </Box>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        <Box display={["block", "none"]}>
          <Box textAlign="left" py={2}>
            <Typography
              fontSize="20px"
              fontWeight={600}
              color="#959494"
              textAlign="left"
              marginLeft={2}
            >
              Price
            </Typography>

            <TableContainer
              sx={{
                backgroundColor: "#101035",
                "& td, & th": {
                  borderBottom: "none",
                },
              }}
            >
              <Table>
                <TableHead>
                  <TableRow
                    sx={{
                      "& td": {
                        paddingBottom: "1px", 
                      },
                    }}
                  >
                    <TableCell sx={{ fontSize: "12px", color: " #A0A0A0" }}>
                      Free
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "12px",
                        fontWeight: 400,
                        color: " #A0A0A0",
                      }}
                    >
                      Starter
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "12px",
                        fontWeight: 400,
                        color: " #A0A0A0",
                      }}
                    >
                      Growth
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody
                  sx={{
                    "& td": {
                      paddingTop: "0px", 
                    },
                  }}
                >
                  <TableRow>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      $0
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      ${formatPrice(starterPlan?.price)}
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      ${formatPrice(growthPlan?.price)}
                    </TableCell>
                  </TableRow>
                </TableBody>

                <TableHead>
                  <TableRow
                    sx={{
                      "& td": {
                        paddingBottom: "1px", 
                      },
                    }}
                  >
                    <TableCell sx={{ fontSize: "12px", color: " #A0A0A0" }}>
                      Professional
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "12px",
                        fontWeight: 400,
                        color: " #A0A0A0",
                      }}
                    >
                      Enterprise
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody
                  sx={{
                    "& td": {
                      paddingTop: "0px", 
                    },
                  }}
                >
                  <TableRow>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      ${formatPrice(professionalPlan?.price)}
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      Custom pricing
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Divider
                sx={{
                  width: "90%", 
                  mx: "auto", 
                  mt: 1.5, 
                  borderBottom: 1,
                  borderColor: "#3D3D3D",
                }}
              />
            </TableContainer>
          </Box>
          <Box textAlign="left" py={2}>
            <Typography
              fontSize="20px"
              fontWeight={600}
              color="#959494"
              textAlign="left"
              marginLeft={2}
            >
              Chatbots
            </Typography>

            <TableContainer
              sx={{
                backgroundColor: "#101035",
                "& td, & th": {
                  borderBottom: "none",
                },
              }}
            >
              <Table>
                <TableHead>
                  <TableRow
                    sx={{
                      "& td": {
                        paddingBottom: "1px", 
                      },
                    }}
                  >
                    <TableCell sx={{ fontSize: "12px", color: " #A0A0A0" }}>
                      Free
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "12px",
                        fontWeight: 400,
                        color: " #A0A0A0",
                      }}
                    >
                      Starter
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "12px",
                        fontWeight: 400,
                        color: " #A0A0A0",
                      }}
                    >
                      Growth
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody
                  sx={{
                    "& td": {
                      paddingTop: "0px", 
                    },
                  }}
                >
                  <TableRow>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      1
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      1
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      2
                    </TableCell>
                  </TableRow>
                </TableBody>

                <TableHead>
                  <TableRow
                    sx={{
                      "& td": {
                        paddingBottom: "1px", 
                      },
                    }}
                  >
                    <TableCell sx={{ fontSize: "12px", color: " #A0A0A0" }}>
                      Professional
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "12px",
                        fontWeight: 400,
                        color: " #A0A0A0",
                      }}
                    >
                      Enterprise
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody
                  sx={{
                    "& td": {
                      paddingTop: "0px", 
                    },
                  }}
                >
                  <TableRow>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      5
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      Custom{" "}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Divider
                sx={{
                  width: "90%", 
                  mx: "auto", 
                  mt: 1.5, 
                  borderBottom: 1,
                  borderColor: "#3D3D3D",
                }}
              />
            </TableContainer>
          </Box>

          <Box textAlign="left" py={2}>
            <Typography
              fontSize="20px"
              fontWeight={600}
              color="#959494"
              textAlign="left"
              marginLeft={2}
            >
              YouTube grounding
            </Typography>

            <TableContainer
              sx={{
                backgroundColor: "#101035",
                "& td, & th": {
                  borderBottom: "none",
                },
              }}
            >
              <Table>
                <TableHead>
                  <TableRow
                    sx={{
                      "& td": {
                        paddingBottom: "1px", 
                      },
                    }}
                  >
                    <TableCell sx={{ fontSize: "12px", color: " #A0A0A0" }}>
                      Free
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "12px",
                        fontWeight: 400,
                        color: " #A0A0A0",
                      }}
                    >
                      Starter
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "12px",
                        fontWeight: 400,
                        color: " #A0A0A0",
                      }}
                    >
                      Growth
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody
                  sx={{
                    "& td": {
                      paddingTop: "0px", 
                    },
                  }}
                >
                  <TableRow>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      <Box display="flex" justifyContent="left">
                        <StyledImage
                          src={getImagePath("images/icons/icon-cancel.png")} 
                          sx={{
                            width: "24px",
                            height: "24px",
                            marginBottom: 0,
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      <Box display="flex" justifyContent="left">
                        <StyledImage
                          src={getImagePath("images/icons/icon-check.png")} 
                          sx={{
                            width: "24px",
                            height: "24px",
                            marginBottom: 0,
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      <Box display="flex" justifyContent="left">
                        <StyledImage
                          src={getImagePath("images/icons/icon-check.png")} 
                          sx={{
                            width: "24px",
                            height: "24px",
                            marginBottom: 0,
                          }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableBody>

                <TableHead>
                  <TableRow
                    sx={{
                      "& td": {
                        paddingBottom: "1px", 
                      },
                    }}
                  >
                    <TableCell sx={{ fontSize: "12px", color: " #A0A0A0" }}>
                      Professional
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "12px",
                        fontWeight: 400,
                        color: " #A0A0A0",
                      }}
                    >
                      Enterprise
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody
                  sx={{
                    "& td": {
                      paddingTop: "0px", 
                    },
                  }}
                >
                  <TableRow>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      <Box display="flex" justifyContent="left">
                        <StyledImage
                          src={getImagePath("images/icons/icon-check.png")} 
                          sx={{
                            width: "24px",
                            height: "24px",
                            marginBottom: 0,
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: "14px", fontWeight: 400, color: "white" }}
                    >
                      <Box display="flex" justifyContent="left">
                        <StyledImage
                          src={getImagePath("images/icons/icon-check.png")} 
                          sx={{
                            width: "24px",
                            height: "24px",
                            marginBottom: 0,
                          }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
