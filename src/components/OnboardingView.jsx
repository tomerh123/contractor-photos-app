import React, { useState } from 'react';
import { User, Building, Wrench, Mail, Lock, Phone, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useApp } from '../AppContext';

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

    const [step, setStep] = useState(1);
    const [isLogin, setIsLogin] = useState(true);

    // Step 1
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Step 2
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    // Step 3
    const [company, setCompany] = useState('');
    const [trade, setTrade] = useState('');

    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Smart handling of orphaned auth accounts and destructive AppContext loading re-mounts
    React.useEffect(() => {
        let hasChecked = false;
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user && !hasChecked) {
                hasChecked = true;

                const pendingStep = sessionStorage.getItem('pendingProfileStep');
                if (pendingStep === '2') {
                    // They just authenticated and AppContext ripped the component away. Restore them to Step 2.
                    sessionStorage.removeItem('pendingProfileStep');
                    setStep(2);
                    setIsLogin(false);

                    if (user.email && user.email.includes('@contractorphotos')) {
                        const extractedPhone = user.email.split('@')[0];
                        setPhone(extractedPhone);
                    }
                }
                // If they are an orphaned session that loaded the app fresh,
                // do NOT force them to Step 2. Let them start at Step 1 (Login).
                // They can seamlessly authenticate into their ghost account to reach Step 2 locally.
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

                const pseudoEmail = generatePseudoEmail(phone);

                if (isLogin) {
                    // Logic for Login
                    sessionStorage.setItem('pendingProfileStep', '2');
                    await signInWithEmailAndPassword(auth, pseudoEmail, password);
                } else {
                    // Logic for Signup Step 1
                    try {
                        sessionStorage.setItem('pendingProfileStep', '2');
                        await createUserWithEmailAndPassword(auth, pseudoEmail, password);
                    } catch (err) {
                        sessionStorage.removeItem('pendingProfileStep');
                        if (err.code === 'auth/email-already-in-use') {
                            throw new Error("This phone number is already registered. Please log in.");
                        }
                        throw err;
                    }
                }

                // Authentication succeeded! 
                // For new users, AppContext will unmount this component right now. This local state update may be ignored.
                // For existing orphaned users, AppContext will NOT unmount us! We must explicitly advance them locally.
                setStep(2);
                setIsLogin(false);
            }
            else if (step === 2) {
                if (!name.trim()) throw new Error("Please enter your full name.");
                setStep(3); // Advance to collect trade
            }
            else if (step === 3) {
                if (!trade) throw new Error("Please select your primary trade.");

                const user = auth.currentUser;
                if (!user) throw new Error("Authentication lost. Please restart.");

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

                // Manually trigger the app context to realize the profile is ready!
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
                        {isLogin ? 'Welcome Back' : (step === 1 ? 'Create Account' : step === 2 ? 'Your Details' : 'Almost Done')}
                    </h1>

                    {/* Progress indicators for signup */}
                    {!isLogin && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
                            {[1, 2, 3].map(s => (
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
                        </>
                    )}

                    {step === 2 && (
                        <div style={{ animation: 'fadeIn 0.4s' }}>
                            <div style={{ position: 'relative', marginBottom: '1.2rem' }}>
                                <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Full Name"
                                    required
                                    autoFocus
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 2.8rem', backgroundColor: 'var(--background)', color: 'white', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '1.05rem', outline: 'none' }}
                                />
                            </div>

                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="Email Address (Optional)"
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 2.8rem', backgroundColor: 'var(--background)', color: 'white', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '1.05rem', outline: 'none' }}
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px', display: 'block', paddingLeft: '4px' }}>
                                    Helpful if you ever need to recover your account.
                                </span>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div style={{ animation: 'fadeIn 0.4s' }}>
                            <div style={{ position: 'relative', marginBottom: '1.2rem' }}>
                                <Building size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="text"
                                    value={company}
                                    onChange={e => setCompany(e.target.value)}
                                    placeholder="Company Name (Optional)"
                                    autoFocus
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
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '1rem', fontWeight: 'bold', fontSize: '1.05rem', marginTop: '0.5rem', borderRadius: '12px' }}
                    >
                        {isProcessing ? 'Processing...' : (
                            isLogin ? 'Log In' : (step === 3 ? 'Complete Setup' : 'Continue')
                        )}
                        {!isProcessing && !isLogin && step < 3 && <ArrowRight size={18} />}
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
