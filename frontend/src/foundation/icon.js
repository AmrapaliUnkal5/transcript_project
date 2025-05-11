import React from "react";
import styled from "styled-components";
import {
  background,
  border,
  color,
  flexbox,
  grid,
  layout,
  position,
  shadow,
  space,
  system,
} from "styled-system";

const fill = system({
  fill: {
    property: "fill",
    scale: "colors",
  },
});
const stroke = system({
  stroke: {
    property: "stroke",
    scale: "colors",
  },
});

function SVGIcon({ icon, toolTip = "", tooltipPlace = "top", ...props }) {
  return (
    <IconContainer {...props}>
      <use xlinkHref={`#${icon}`} />
    </IconContainer>
  );
}

export const iconList = [
  "icon-approval",
  "icon-approved",
  "icon-calendar",
  "icon-comission",
  "icon-flexi",
  "icon-health",
  "icon-info",
  "icon-inprocess",
  "icon-menu-icon",
  "icon-truck",
  "icon-paid",
  "icon-refresh",
  "icon-sort",
  "icon-staff",
  "icon-study",
  "icon-success",
  "icon-success-list",
  "icon-dnd-clock",
];
const IconContainer = styled.svg`
  ${space}
  ${color}
    ${layout}
    ${flexbox}
    ${grid}
    ${background}
    ${border}
    ${position}
    ${shadow}
    ${fill}
    ${stroke}
`;

export default SVGIcon;
