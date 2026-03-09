import React, { useState } from 'react';
import { User, Building, Wrench, Mail, Lock, Phone, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useApp } from '../AppContext';
import LoadingSpinner from './LoadingSpinner';

const COMMON_TRADES = [
    'General Contractor',
    'Low Voltage',
    'Electrical',
    'Plumbing',
    'HVAC',
    'Framing',
    'Drywall',
    'Painting',
    'Roofing',
    'Tile / Stone',
    'Flooring',
    'Cabinetry',
    'Landscaping',
    'Other'
];

const OnboardingView = () => {
    const { refreshProfile } = useApp();

    const [step, setStep] = useState(() => {
        const pending = sessionStorage.getItem('pendingProfileStep');
        if (pending) return parseInt(pending);
        return 1;
    });
    const [isLogin, setIsLogin] = useState(() => {
        const pending = sessionStorage.getItem('pendingProfileStep');
        if (pending) return false;
        return true;
    });

    // Step 1
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');

    // Step 2 (Signup)
    const [email, setEmail] = useState('');
    const [company, setCompany] = useState('');
    const [trade, setTrade] = useState('');

    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // ... useEffect remains same ...
    React.useEffect(() => {
        let hasChecked = false;
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user && !hasChecked) {
                hasChecked = true;

                const pendingStep = sessionStorage.getItem('pendingProfileStep');
                if (pendingStep === '2') {
                    sessionStorage.removeItem('pendingProfileStep');
                    setStep(2);
                    setIsLogin(false);

                    if (user.email && user.email.includes('@contractorphotos')) {
                        const extractedPhone = user.email.split('@')[0];
                        setPhone(extractedPhone);
                    }
                }
            }
        });
        return () => unsubscribe();
    }, []);

    const generatePseudoEmail = (phoneNumber) => {
        const raw = phoneNumber.replace(/\D/g, '');
        return `${raw}@contractorphotos.app`;
    };

    const handleNextStep = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setIsProcessing(true);

        try {
            if (step === 1) {
                const rawPhone = phone.replace(/\D/g, '');
                if (rawPhone.length < 10) throw new Error("Please enter a valid 10-digit phone number.");
                if (password.length < 6) throw new Error("Password must be at least 6 characters.");

                if (!isLogin) {
                    if (!name.trim()) throw new Error("Please enter your full name.");
                    if (password !== confirmPassword) throw new Error("Passwords do not match.");
                    
                    // SIGNUP: Just advance locally. Do NOT create auth account yet.
                    setStep(2);
                    return;
                }

                // LOGIN: Immediate authentication
                const pseudoEmail = generatePseudoEmail(phone);
                await signInWithEmailAndPassword(auth, pseudoEmail, password);
                
                // For existing orphaned users, advancement might not be automatic
                await refreshProfile(auth.currentUser.uid);
            }
            else if (step === 2) {
                if (!trade) throw new Error("Please select your primary trade.");

                // ATOMIC SIGNUP: Create both Auth + Firestore profile now
                const pseudoEmail = generatePseudoEmail(phone);
                let user;
                
                try {
                    const userCredential = await createUserWithEmailAndPassword(auth, pseudoEmail, password);
                    user = userCredential.user;
                } catch (err) {
                    if (err.code === 'auth/email-already-in-use') {
                        throw new Error("This phone number is already registered. Please go back and log in.");
                    }
                    throw err;
                }

                if (!user) throw new Error("Authentication failed. Please try again.");

                // Save profile to Firestore
                await setDoc(doc(db, 'users', user.uid), {
                    Name: name.trim(),
                    Email: email.trim(),
                    Phone: phone.replace(/\D/g, ''),
                    Company: company.trim(),
                    Trade: trade,
                    JobTitle: 'Pro',
                    CreatedAt: new Date().toISOString()
                });

                sessionStorage.removeItem('pendingProfileStep');
                await refreshProfile(user.uid);
            }
        } catch (error) {
            console.error(error);
            setErrorMsg(error.message.replace('Firebase:', '').trim());
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div style={{
            minHeight: '100dvh',
            width: '100%',
            backgroundColor: 'var(--background)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '2rem 1rem',
            color: 'var(--text-primary)'
        }}>

            <div style={{
                width: '100%',
                maxWidth: '400px',
                backgroundColor: 'var(--surface)',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.5rem', position: 'relative' }}>
                    {step > 1 && (
                        <button
                            onClick={() => setStep(step - 1)}
                            style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}>
                        {isLogin ? 'Welcome Back' : (step === 1 ? 'Create Account' : 'Almost Done')}
                    </h1>

                    {/* Progress indicators for signup */}
                    {!isLogin && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
                            {[1, 2].map(s => (
                                <div key={s} style={{
                                    height: '6px',
                                    width: '30px',
                                    borderRadius: '3px',
                                    backgroundColor: s <= step ? 'var(--primary-color)' : 'var(--border)',
                                    transition: 'all 0.3s ease'
                                }} />
                            ))}
                        </div>
                    )}
                </div>

                {errorMsg && (
                    <div style={{ padding: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.4 }}>
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                    {step === 1 && (
                        <>
                            {!isLogin && (
                                <div style={{ position: 'relative' }}>
                                    <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Full Name"
                                        required
                                        style={{ width: '100%', padding: '1rem 1rem 1rem 2.8rem', backgroundColor: 'var(--background)', color: 'white', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '1.05rem', outline: 'none' }}
                                    />
                                </div>
                            )}

                            <div style={{ position: 'relative' }}>
                                <Phone size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="Phone number"
                                    required
                                    autoComplete="off"
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 2.8rem', backgroundColor: 'var(--background)', color: 'white', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '1.05rem', outline: 'none' }}
                                />
                            </div>

                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Password"
                                    required
                                    minLength={6}
                                    autoComplete="off"
                                    style={{
                                        width: '100%',
                                        padding: '1rem 2.8rem 1rem 2.8rem',
                                        backgroundColor: 'var(--background)',
                                        color: 'white',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        fontSize: '1.05rem',
                                        outline: 'none',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex' }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {!isLogin && (
                                <div style={{ position: 'relative' }}>
                                    <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm Password"
                                        required
                                        minLength={6}
                                        autoComplete="off"
                                        style={{ width: '100%', padding: '1rem 2.8rem 1rem 2.8rem', backgroundColor: 'var(--background)', color: 'white', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '1.05rem', outline: 'none' }}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {step === 2 && (
                        <div style={{ animation: 'fadeIn 0.4s', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="Email Address (Optional)"
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 2.8rem', backgroundColor: 'var(--background)', color: 'white', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '1.05rem', outline: 'none' }}
                                />
                            </div>

                            <div style={{ position: 'relative' }}>
                                <Building size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="text"
                                    value={company}
                                    onChange={e => setCompany(e.target.value)}
                                    placeholder="Company Name (Optional)"
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 2.8rem', backgroundColor: 'var(--background)', color: 'white', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '1.05rem', outline: 'none' }}
                                />
                            </div>

                            <div style={{ position: 'relative' }}>
                                <Wrench size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <select
                                    value={trade}
                                    onChange={e => setTrade(e.target.value)}
                                    required
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 2.8rem', backgroundColor: 'var(--background)', color: trade ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '1.05rem', outline: 'none', appearance: 'none' }}
                                >
                                    <option value="" disabled>Select your primary trade...</option>
                                    {COMMON_TRADES.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isProcessing}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '8px', 
                            padding: '1rem', 
                            fontWeight: 'bold', 
                            fontSize: '1.05rem', 
                            marginTop: '0.5rem', 
                            borderRadius: '12px',
                            minHeight: '56px' // Prevent height jump
                        }}
                    >
                        {isProcessing ? (
                            <LoadingSpinner fullScreen={false} size="20px" />
                        ) : (
                            isLogin ? 'Log In' : (step === 2 ? 'Complete Setup' : 'Continue')
                        )}
                        {!isProcessing && !isLogin && step < 2 && <ArrowRight size={18} />}
                    </button>

                    {step === 1 && (
                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.90rem', cursor: 'pointer', padding: '8px' }}
                            >
                                {isLogin ? (
                                    <>Don't have an account? <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Sign up</span></>
                                ) : (
                                    <>Already have an account? <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Log in</span></>
                                )}
                            </button>
                        </div>
                    )}

                </form>

            </div>

        </div>
    );
};

export default OnboardingView;
