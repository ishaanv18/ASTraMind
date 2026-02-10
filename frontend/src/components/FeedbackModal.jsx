import { useState } from 'react';
import GradientButton from './GradientButton';
import './FeedbackModal.css';
import API_BASE_URL from '../config/apiConfig';

function FeedbackModal({ user }) {
    const [isOpen, setIsOpen] = useState(false);
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [selectedEmoji, setSelectedEmoji] = useState('');
    const [feedbackText, setFeedbackText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const emojis = [
        { emoji: '😢', label: 'Very Dissatisfied' },
        { emoji: '😐', label: 'Dissatisfied' },
        { emoji: '😊', label: 'Neutral' },
        { emoji: '😍', label: 'Satisfied' },
        { emoji: '🎉', label: 'Very Satisfied' }
    ];

    const handleSubmit = async () => {
        if (rating === 0) {
            alert('Please select a rating');
            return;
        }

        try {
            setSubmitting(true);
            const response = await fetch(`${API_BASE_URL}/feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rating,
                    emoji: selectedEmoji,
                    text: feedbackText.trim() || null,
                    username: user?.username || 'Anonymous'
                }),
            });

            if (response.ok) {
                setSubmitted(true);
                setTimeout(() => {
                    setIsOpen(false);
                    resetForm();
                }, 2000);
            } else {
                alert('Failed to submit feedback. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            alert('Failed to submit feedback. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setRating(0);
        setSelectedEmoji('');
        setFeedbackText('');
        setSubmitted(false);
    };

    if (!isOpen) {
        return (
            <button
                className="feedback-fab"
                onClick={() => setIsOpen(true)}
                title="Give Feedback"
            >
                💬
            </button>
        );
    }

    return (
        <div className="feedback-overlay" onClick={() => setIsOpen(false)}>
            <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
                {submitted ? (
                    <div className="feedback-success">
                        <div className="success-icon">✅</div>
                        <h2>Thank You!</h2>
                        <p>Your feedback has been submitted successfully.</p>
                    </div>
                ) : (
                    <>
                        <div className="feedback-header">
                            <h2>Share Your Feedback</h2>
                            <button className="close-btn" onClick={() => setIsOpen(false)}>
                                ✕
                            </button>
                        </div>

                        <div className="feedback-content">
                            {/* Star Rating */}
                            <div className="rating-section">
                                <label>How would you rate your experience?</label>
                                <div className="stars">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                            key={star}
                                            className={`star ${star <= (hoveredRating || rating) ? 'active' : ''}`}
                                            onClick={() => setRating(star)}
                                            onMouseEnter={() => setHoveredRating(star)}
                                            onMouseLeave={() => setHoveredRating(0)}
                                        >
                                            ⭐
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Emoji Reactions */}
                            <div className="emoji-section">
                                <label>How do you feel?</label>
                                <div className="emojis">
                                    {emojis.map(({ emoji, label }) => (
                                        <button
                                            key={emoji}
                                            className={`emoji-btn ${selectedEmoji === emoji ? 'selected' : ''}`}
                                            onClick={() => setSelectedEmoji(emoji)}
                                            title={label}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Optional Text */}
                            <div className="text-section">
                                <label>Tell us more (optional)</label>
                                <textarea
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                    placeholder="Share your thoughts, suggestions, or report issues..."
                                    rows="4"
                                />
                            </div>

                            {/* Submit Button */}
                            <GradientButton
                                onClick={handleSubmit}
                                disabled={submitting || rating === 0}
                                style={{ width: '100%', marginTop: '16px' }}
                            >
                                {submitting ? 'Submitting...' : 'Submit Feedback'}
                            </GradientButton>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default FeedbackModal;
