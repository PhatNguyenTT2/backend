const mongoose = require('mongoose')

const detailProductSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required'],
    unique: true
  },

  image: {
    type: String,
    required: [true, 'Image is required']
  },

  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description must be at most 2000 characters long']
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for faster queries
detailProductSchema.index({ product: 1 })

// Method to update image
detailProductSchema.methods.updateImage = function (newImageUrl) {
  this.image = newImageUrl
  return this.save()
}

// Method to update description
detailProductSchema.methods.updateDescription = function (newDescription) {
  this.description = newDescription
  return this.save()
}

// Method to update all details
detailProductSchema.methods.updateDetails = function (detailData) {
  if (detailData.image !== undefined) {
    this.image = detailData.image
  }
  if (detailData.description !== undefined) {
    this.description = detailData.description
  }
  return this.save()
}

// Static method to find by product
detailProductSchema.statics.findByProduct = function (productId) {
  return this.findOne({ product: productId })
}

// Static method to create detail with product
detailProductSchema.statics.createWithProduct = async function (productId, detailData) {
  const Product = mongoose.model('Product')
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Check if product exists
    const product = await Product.findById(productId).session(session)
    if (!product) {
      throw new Error('Product not found')
    }

    // Check if detail already exists
    const existingDetail = await this.findOne({ product: productId }).session(session)
    if (existingDetail) {
      throw new Error('Product detail already exists')
    }

    // Create detail
    const detail = new this({
      product: productId,
      ...detailData
    })
    await detail.save({ session })

    await session.commitTransaction()
    return detail
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// Static method to bulk update details
detailProductSchema.statics.bulkUpdateDetails = async function (updates) {
  const bulkOps = updates.map(update => ({
    updateOne: {
      filter: { product: update.productId },
      update: { $set: update.data },
      upsert: false
    }
  }))

  return this.bulkWrite(bulkOps)
}

detailProductSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('DetailProduct', detailProductSchema)
