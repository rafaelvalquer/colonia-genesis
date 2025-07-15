// src/components/WaterAlertLottie.jsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import Lottie from "lottie-react";
import waterAlertAnim from "../assets/lottie/water-alert.json";

const WaterAlertLottie = ({ open, onClose, aguaNecessaria }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle className="text-center text-lg font-bold text-blue-700">
        💧 Água Insuficiente
      </DialogTitle>
      <DialogContent className="flex flex-col items-center justify-center text-center">
        <Lottie
          animationData={waterAlertAnim}
          loop={true}
          style={{ width: 150, height: 150 }}
        />
        <p className="text-gray-700 text-sm mt-2">
          É necessário <strong>{aguaNecessaria}</strong> de água para rodar o
          turno.
        </p>
      </DialogContent>
      <DialogActions className="flex justify-center pb-4">
        <Button onClick={onClose} variant="contained" color="primary">
          Entendi
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WaterAlertLottie;
