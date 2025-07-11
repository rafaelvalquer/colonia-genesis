import { useRef, useEffect } from "react";
import Lottie from "lottie-react";
import fireAnimation from "../assets/lottie/fire.json"; // ajuste o caminho conforme seu projeto

const FireLottie = ({ speed = 1 }) => {
    const lottieRef = useRef();

    useEffect(() => {
        if (lottieRef.current) {

            const frameMap = {
                0: 1,
                1: 1,
                2: 1.5,
                3: 2,
            };

            lottieRef.current.setSpeed(frameMap[speed]); // Velocidade da animação
        }
    }, [speed]); // Adicione speed como dependência para que o efeito seja executado quando speed mudar

    return (
        <div className="w-10 h-10 mx-auto">
            <Lottie
                lottieRef={lottieRef}
                animationData={fireAnimation}
                loop
                autoplay
            />
        </div>
    );
};

export default FireLottie;
