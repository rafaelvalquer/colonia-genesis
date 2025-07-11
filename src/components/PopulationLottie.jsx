import { useRef, useEffect } from "react";
import Lottie from "lottie-react";
import populationAnimation from "../assets/lottie/population.json"; // ajuste o caminho conforme seu projeto

const PopulationLottie = ({ speed = 1 }) => {
    const lottieRef = useRef();

    useEffect(() => {
        if (lottieRef.current) {
            lottieRef.current.setSpeed(speed); // Velocidade da animação
        }
    }, [speed]); // Adicione speed como dependência para que o efeito seja executado quando speed mudar

    return (
        <div className="w-12 h-10 mx-auto">
            <Lottie
                lottieRef={lottieRef}
                animationData={populationAnimation}
                loop
                autoplay
            />
        </div>
    );
};

export default PopulationLottie;
