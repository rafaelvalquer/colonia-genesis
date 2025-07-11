import { useRef, useEffect } from "react";
import Lottie from "lottie-react";
import waterAnimation from "../assets/lottie/water.json"; // ajuste o caminho conforme seu projeto

const WaterLottie = ({ speed = 1 }) => { // Desestruture a prop speed
  const lottieRef = useRef();

  useEffect(() => {
    if (lottieRef.current) {
        speed = speed * 2;
      lottieRef.current.setSpeed(speed); // Velocidade da animação
    }
  }, [speed]); // Adicione speed como dependência para que o efeito seja executado quando speed mudar

  return (
    <div className="w-10 h-10 mx-auto">
      <Lottie 
        lottieRef={lottieRef}
        animationData={waterAnimation}
        loop
        autoplay
      />
    </div>
  );
};

export default WaterLottie;
