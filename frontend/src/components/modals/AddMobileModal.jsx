import React, { useState, useRef, useCallback } from 'react';
import { X, Camera, Upload, Smartphone, Check, Image as ImageIcon, Trash2, Plus } from 'lucide-react';
import Webcam from 'react-webcam';
import { deviceService } from '../../services/api';

export default function AddMobileModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    brand: 'Apple',
    customBrand: '',
    model: '',
    storage: '128',
    ram: '6',
    colour: 'Midnight Black',
    purchase_amount: '',
    paid_by: 'Jeet Khubchandani',
    conditionStatus: 'OLD_INVENTORY',
    remarks: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Support for at least 2 images (e.g. Front & Back)
  const [images, setImages] = useState({
    image1: null, // Front / Screen
    image2: null, // Back / Body
    additional: [] // Any extra photos
  });

  const [activeCameraSlot, setActiveCameraSlot] = useState(null); // 'image1' | 'image2' | null
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const webcamRef = useRef(null);

  const capturePhoto = useCallback(() => {
    if (webcamRef.current && activeCameraSlot) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (activeCameraSlot === 'image1') {
        setImages(prev => ({ ...prev, image1: imageSrc }));
      } else if (activeCameraSlot === 'image2') {
        setImages(prev => ({ ...prev, image2: imageSrc }));
      }
      setActiveCameraSlot(null);
    }
  }, [webcamRef, activeCameraSlot]);

  const handleSingleSlotUpload = (slot, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImages(prev => ({ ...prev, [slot]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleMultiFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (index === 0) {
          setImages(prev => ({ ...prev, image1: reader.result }));
        } else if (index === 1) {
          setImages(prev => ({ ...prev, image2: reader.result }));
        } else {
          setImages(prev => ({ ...prev, additional: [...prev.additional, reader.result] }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (slot) => {
    if (slot === 'image1') setImages(prev => ({ ...prev, image1: null }));
    if (slot === 'image2') setImages(prev => ({ ...prev, image2: null }));
  };

  const removeAdditionalImage = (index) => {
    setImages(prev => ({
      ...prev,
      additional: prev.additional.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;
    setError('');

    const effectiveBrand = (formData.brand === 'Other' ? formData.customBrand : formData.brand) || 'Apple';
    const effectiveModel = formData.model ? formData.model.trim() : '';

    if (!effectiveModel || formData.purchase_amount === '' || formData.purchase_amount === null || formData.purchase_amount === undefined) {
      setError('Please enter Mobile Model Name and Purchased Amount');
      return;
    }

    const allImagesList = [images.image1, images.image2, ...images.additional].filter(Boolean);
    const mainImageUrl = images.image1 || images.image2 || 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=100';

    const pAmount = parseFloat(formData.purchase_amount) || 0;
    const selectedPayer = (formData.paid_by || 'Jeet Khubchandani').toLowerCase().includes('sonal')
      ? 'Sonal Wadwani'
      : 'Jeet Khubchandani';

    // Duplicate Check: Check if exact same device already exists in Add Inventory
    const existingOldInv = JSON.parse(localStorage.getItem('mrx_old_inventory') || '[]');
    const existingDevs = JSON.parse(localStorage.getItem('mrx_devices') || '[]');
    const isDuplicate = [...existingOldInv, ...existingDevs].some(item => {
      if (!item) return false;
      const bMatch = (item.brand || item.oldBrand || '').trim().toLowerCase() === effectiveBrand.trim().toLowerCase();
      const mMatch = (item.model || item.oldModel || '').trim().toLowerCase() === effectiveModel.trim().toLowerCase();
      const stMatch = (Number(item.storage) || 128) === (Number(formData.storage) || 128);
      const ramMatch = (Number(item.ram) || 6) === (Number(formData.ram) || 6);
      const amtMatch = Math.abs((Number(item.purchase_amount || item.amount) || 0) - pAmount) < 1;
      return bMatch && mMatch && stMatch && ramMatch && amtMatch;
    });

    if (isDuplicate) {
      setError(`Duplicate Mobile Entry! A device "${effectiveBrand} ${effectiveModel} (${formData.storage || 128}GB)" with Purchase Amount ₹${pAmount.toLocaleString('en-IN')} already exists in Add Inventory.`);
      return;
    }

    const localDeviceObj = {
      id: `dev_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      device_code: `MRX-${Date.now().toString().slice(-5)}`,
      brand: effectiveBrand,
      model: effectiveModel,
      storage: Number(formData.storage) || 128,
      ram: Number(formData.ram) || 6,
      colour: formData.colour || 'Midnight Black',
      condition: 'Good',
      purchase_amount: pAmount,
      paid_amount: pAmount,
      paidAmount: pAmount,
      amount: pAmount,
      paid_by: selectedPayer,
      purchasedBy: selectedPayer,
      paidBy: selectedPayer,
      intake_date: formData.date || new Date().toISOString().split('T')[0],
      status: 'OLD_INVENTORY',
      remarks: formData.remarks || '',
      image_url: mainImageUrl,
      image_data: mainImageUrl,
      images: allImagesList.length > 0 ? allImagesList : [mainImageUrl]
    };

    let targetObj = localDeviceObj;

    try {
      setLoading(true);
      const apiCreated = await deviceService.createDevice({
        ...formData,
        id: localDeviceObj.id,
        brand: effectiveBrand,
        model: effectiveModel,
        status: 'OLD_INVENTORY',
        paid_by: selectedPayer,
        purchasedBy: selectedPayer,
        paidBy: selectedPayer,
        purchase_amount: pAmount,
        paid_amount: pAmount,
        paidAmount: pAmount,
        amount: pAmount,
        image_url: mainImageUrl,
        image_data: mainImageUrl,
        images: allImagesList
      });
      if (apiCreated && (apiCreated.id || apiCreated.brand)) {
        targetObj = { ...localDeviceObj, ...apiCreated, status: 'OLD_INVENTORY' };
      }
    } catch (err) {
      console.warn('Backend API creation offline/failed, using local storage fallback:', err);
    }

    // Save strictly to mrx_old_inventory with status OLD_INVENTORY by default
    try {
      const oldInventoryStock = JSON.parse(localStorage.getItem('mrx_old_inventory') || '[]');
      const filteredInv = oldInventoryStock.filter(d => 
        String(d.id) !== String(targetObj.id) &&
        (!targetObj.device_code || String(d.device_code) !== String(targetObj.device_code)) &&
        !(d.brand === targetObj.brand && d.model === targetObj.model && Number(d.purchase_amount) === Number(targetObj.purchase_amount) && d.intake_date === targetObj.intake_date)
      );
      localStorage.setItem('mrx_old_inventory', JSON.stringify([{ ...targetObj, status: 'OLD_INVENTORY' }, ...filteredInv]));
    } catch (e) {
      console.error('Error writing to localStorage:', e);
    }

    // Record capital investment entry for Jeet / Sonal so it is added to their Investment pool
    if (pAmount > 0) {
      try {
        const newInvRecord = {
          id: `inv_dev_${Date.now()}`,
          investment_code: `INV-${Date.now().toString().slice(-6)}`,
          investment_type: 'INVENTORY',
          amount: pAmount,
          investor_name: selectedPayer,
          admin_name: selectedPayer,
          investment_date: formData.date || new Date().toISOString().split('T')[0],
          remarks: `Device Intake: ${effectiveBrand} ${effectiveModel}`
        };
        const existingInv = JSON.parse(localStorage.getItem('mrx_investments') || '[]');
        localStorage.setItem('mrx_investments', JSON.stringify([newInvRecord, ...existingInv]));
      } catch (invErr) {
        console.error('Error writing investment:', invErr);
      }
    }

    // Trigger update events across tabs & components
    window.dispatchEvent(new Event('mrx_investments_updated'));
    window.dispatchEvent(new Event('mrx_inventory_updated'));
    window.dispatchEvent(new Event('storage'));

    setLoading(false);
    setFormData({
      brand: 'Apple',
      customBrand: '',
      model: '',
      storage: '128',
      ram: '6',
      colour: 'Midnight Black',
      purchase_amount: '',
      paid_by: 'Jeet Khubchandani',
      conditionStatus: 'OLD_INVENTORY',
      remarks: '',
      date: new Date().toISOString().split('T')[0]
    });
    setImages({ image1: null, image2: null, additional: [] });

    alert(`Mobile "${targetObj.brand} ${targetObj.model}" added successfully to Inventory!`);

    if (onSuccess) onSuccess();
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '640px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Fixed Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Smartphone size={18} color="#0284c7" />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>Add Mobile Entry</h3>
              <p style={{ fontSize: '11px', color: '#64748b' }}>Enter device specifications and upload at least 2 images</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            style={{ color: '#64748b', padding: 6, borderRadius: 6, background: '#f1f5f9' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Scrollable Form Body */}
          <div 
            className="modal-body" 
            style={{ 
              maxHeight: 'calc(88vh - 130px)', 
              overflowY: 'auto', 
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', fontSize: '13px', border: '1px solid #fecaca' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Row 1: Mobile Name & Model */}
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Mobile Name *</label>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="e.g. Apple, Samsung, OnePlus"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Mobile Model *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. iPhone 15 Pro, Galaxy S24" 
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </div>
            </div>

            {/* Row 2: Storage & RAM (Normal Editable Inputs) */}
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Storage in GB *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. 128, 256, 512" 
                  value={formData.storage}
                  onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">RAM in GB *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. 6, 8, 12, 16" 
                  value={formData.ram}
                  onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                />
              </div>
            </div>

            {/* Row 3: Color & Date Added */}
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Color (in words) *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Space Grey, Phantom Black, Sierra Blue" 
                  value={formData.colour}
                  onChange={(e) => setFormData({ ...formData, colour: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date Added *</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>

            {/* Row 4: Paid Amount & Paid By */}
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Paid Amount (₹ INR) *</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="e.g. 24000" 
                  value={formData.purchase_amount}
                  onChange={(e) => setFormData({ ...formData, purchase_amount: e.target.value })}
                  min="0"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Paid By (Super Admin Investment) *</label>
                <select 
                  className="form-control"
                  value={formData.paid_by}
                  onChange={(e) => setFormData({ ...formData, paid_by: e.target.value })}
                  style={{ fontWeight: 700 }}
                >
                  <option value="Jeet Khubchandani">Jeet Khubchandani</option>
                  <option value="Sonal Wadwani">Sonal Wadwani</option>
                </select>
              </div>
            </div>

            {/* Remarks */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Remarks / Accessories</label>
              <textarea 
                className="form-control" 
                rows="2"
                placeholder="Additional notes about device condition, battery health, box/charger accessories..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              />
            </div>

            {/* DUAL IMAGE UPLOAD SECTION */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Device Images (At least 2 images recommended)</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Front / Screen view and Back / Body view</div>
                </div>

                <label className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                  <Upload size={14} color="#0284c7" /> Select Multiple from Files
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    onChange={handleMultiFileUpload}
                    style={{ display: 'none' }} 
                  />
                </label>
              </div>

              {/* Webcam Live Capture View (Rear/Back Camera preferred) */}
              {activeCameraSlot && (
                <div style={{ textAlign: 'center', background: '#0b132b', borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
                  <div style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                    Capturing for {activeCameraSlot === 'image1' ? 'Image 1 (Front View)' : 'Image 2 (Back View)'} (Rear Camera)
                  </div>
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: { ideal: "environment" } }}
                    style={{ width: '100%', maxHeight: '200px', borderRadius: '6px' }}
                  />
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
                    <button type="button" onClick={capturePhoto} className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px' }}>
                      <Camera size={14} /> Snap Photo
                    </button>
                    <button type="button" onClick={() => setActiveCameraSlot(null)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '12px' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* 2 Image Slots Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Slot 1: Front / Screen Photo */}
                <div style={{ background: '#ffffff', borderRadius: '8px', border: images.image1 ? '2px solid #0284c7' : '1px dashed #cbd5e1', padding: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>1. Front Photo (Screen)</span>
                    {images.image1 && <span style={{ color: '#059669', fontSize: '11px', fontWeight: 700 }}>✓ Attached</span>}
                  </div>

                  {images.image1 ? (
                    <div>
                      <img 
                        src={images.image1} 
                        alt="Front Preview" 
                        style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} 
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, cursor: 'pointer' }}>
                          Change
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleSingleSlotUpload('image1', e.target.files[0])} 
                            style={{ display: 'none' }} 
                          />
                        </label>
                        <button 
                          type="button" 
                          onClick={() => removeImage('image1')} 
                          style={{ color: '#dc2626', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', padding: '12px 0' }}>
                      <ImageIcon size={28} color="#94a3b8" />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          type="button" 
                          onClick={() => setActiveCameraSlot('image1')}
                          className="btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                        >
                          <Camera size={12} color="#0284c7" /> Camera
                        </button>
                        <label className="btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', cursor: 'pointer' }}>
                          <Upload size={12} color="#059669" /> File
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleSingleSlotUpload('image1', e.target.files[0])} 
                            style={{ display: 'none' }} 
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Slot 2: Back / Body Photo */}
                <div style={{ background: '#ffffff', borderRadius: '8px', border: images.image2 ? '2px solid #0284c7' : '1px dashed #cbd5e1', padding: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>2. Back Photo (Body)</span>
                    {images.image2 && <span style={{ color: '#059669', fontSize: '11px', fontWeight: 700 }}>✓ Attached</span>}
                  </div>

                  {images.image2 ? (
                    <div>
                      <img 
                        src={images.image2} 
                        alt="Back Preview" 
                        style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} 
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, cursor: 'pointer' }}>
                          Change
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleSingleSlotUpload('image2', e.target.files[0])} 
                            style={{ display: 'none' }} 
                          />
                        </label>
                        <button 
                          type="button" 
                          onClick={() => removeImage('image2')} 
                          style={{ color: '#dc2626', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', padding: '12px 0' }}>
                      <ImageIcon size={28} color="#94a3b8" />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          type="button" 
                          onClick={() => setActiveCameraSlot('image2')}
                          className="btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                        >
                          <Camera size={12} color="#0284c7" /> Camera
                        </button>
                        <label className="btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', cursor: 'pointer' }}>
                          <Upload size={12} color="#059669" /> File
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleSingleSlotUpload('image2', e.target.files[0])} 
                            style={{ display: 'none' }} 
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Extra images if uploaded */}
              {images.additional.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {images.additional.map((extraImg, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                      <img 
                        src={extraImg} 
                        alt={`Extra ${idx}`} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                      />
                      <button
                        type="button"
                        onClick={() => removeAdditionalImage(idx)}
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#dc2626',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc', padding: '14px 24px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading} 
              className="btn-primary" 
              style={{ minWidth: '160px', justifyContent: 'center' }}
            >
              {loading ? 'Saving Device...' : 'Add Mobile Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
