const isTransactionUnsupported = (error) =>
  error?.code === 20 ||
  /Transaction numbers are only allowed|does not support transactions/i.test(error?.message || '');

const runWithTransactionFallback = async (mongoose, operation) => {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result;
  } catch (error) {
    if (!isTransactionUnsupported(error)) {
      throw error;
    }

    // Standalone MongoDB deployments do not support transactions. The caller's
    // operation must be idempotent and ordered safely for this fallback.
    return operation(null);
  } finally {
    await session.endSession();
  }
};

module.exports = runWithTransactionFallback;
