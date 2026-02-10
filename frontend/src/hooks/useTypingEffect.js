import { useState, useEffect } from 'react';

const useTypingEffect = (text, speed = 100) => {
    const [displayedText, setDisplayedText] = useState('');
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        if (!text) return;

        // Start with the first character immediately
        setDisplayedText(text.charAt(0));
        setIsComplete(false);

        if (text.length === 1) {
            setIsComplete(true);
            return;
        }

        let index = 1;
        const timer = setInterval(() => {
            if (index < text.length) {
                setDisplayedText((prev) => prev + text.charAt(index));
                index++;
            } else {
                setIsComplete(true);
                clearInterval(timer);
            }
        }, speed);

        return () => clearInterval(timer);
    }, [text, speed]);

    return { displayedText, isComplete };
};

export default useTypingEffect;
