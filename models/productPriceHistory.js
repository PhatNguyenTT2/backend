const mongoose = require('mongoose');

const productPriceHistorySchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  oldPrice: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },
  newPrice: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },
  reason: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAccount'
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

productPriceHistorySchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model('ProductPriceHistory', productPriceHistorySchema);
