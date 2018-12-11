const { ether } = require('./helpers/ether');
const { advanceBlock } = require('./helpers/advanceToBlock');
const { increaseTimeTo, duration } = require('./helpers/increaseTime');
const { latestTime } = require('./helpers/latestTime');
const { expectThrow } = require('./helpers/expectThrow');
const { EVMRevert } = require('./helpers/EVMRevert');

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

const TimedCrowdsale = artifacts.require('SaiexCrowdsale');
const SimpleToken = artifacts.require('SaiexToken');

contract('TimedCrowdsale', function ([_, investor, wallet, purchaser, otherInvestor]) {
  const rate = new BigNumber(200);
  const value = ether(4.2);
  const tokenSupply    = 1000*500**9; // new BigNumber('1e22');
  const contractSupply = 1000*250**9;
  const ownerSupply    = 1000*250**9;

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock();
  });

  beforeEach(async function () {
		this.latestTime = (await latestTime());
    this.openingTime = this.latestTime + duration.weeks(1);
    this.beforeOpeningTime = this.latestTime + duration.days(5);
    this.newOpeningTime = this.latestTime + duration.days(4);

    this.secondWeek = this.latestTime + duration.weeks(2);
    this.closingTime = this.openingTime + duration.weeks(4);
    this.beforeClosingTime = this.closingTime - duration.seconds(1);
    this.afterClosingTime = this.closingTime + duration.seconds(1);
    this.newClosingTime = this.openingTime + duration.weeks(5);

    this.token = await SimpleToken.new(tokenSupply, contractSupply, ownerSupply, wallet);
//		console.log('openingtime',this.openingTime, this.closingTime);
    this.crowdsale = await TimedCrowdsale.new(this.openingTime, this.closingTime, rate, wallet,
      this.token.address,
      [this.openingTime +  duration.weeks(1),120,    this.openingTime + duration.weeks(2),110,    0,100],
      [ether(10*200),120,    ether(5*200),110,     ether(0),100],
    );
//		console.log('timebonus',      [this.openingTime +  duration.weeks(1),120,    this.openingTime + duration.weeks(2),110,    0,100]);
//		console.log('amount bonus', [ether(10),120,    ether(5),110,     ether(0),100]);

    this.owner = await this.token.owner();
    await this.token.transfer(this.crowdsale.address, contractSupply);
  });

  it('should be ended only after end', async function () {
    let ended = await this.crowdsale.hasClosed();
    ended.should.equal(false);
    await increaseTimeTo(this.afterClosingTime);
    ended = await this.crowdsale.hasClosed();
    ended.should.equal(true);
  });

	describe('accepting payments', function () {
		it('should reject payments before start', async function () {
      await expectThrow(this.crowdsale.send(value), EVMRevert);
      await expectThrow(this.crowdsale.buyTokens(investor, { from: purchaser, value: value }), EVMRevert);
    });

		it('should accept payments after start', async function () {
      await increaseTimeTo(this.openingTime);
      await this.crowdsale.send(value);
      await this.crowdsale.buyTokens(investor, { value: value, from: purchaser });
    });

		it('should reject payments after end', async function () {
      await increaseTimeTo(this.afterClosingTime);
      await expectThrow(this.crowdsale.send(value), EVMRevert);
      await expectThrow(this.crowdsale.buyTokens(investor, { value: value, from: purchaser }), EVMRevert);
    });

		it('should grant an extra 20% tokens as bonus for contributions over 10 ETH', async function () {
       const investmentAmount = ether(15);
       const expectedTokenAmount = rate.mul(investmentAmount).mul(1.2);

       await increaseTimeTo(this.beforeClosingTime);
			 //console.log('investmentAmount', 15,expectedTokenAmount);
       await this.crowdsale.send(investmentAmount);
       await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: purchaser });
       (await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);

     });

		it('should grant an extra 10% tokens as bonus for contributions over 5 ETH', async function () {
			const investmentAmount = ether(5);
			const expectedTokenAmount = rate.mul(investmentAmount).mul(1.1);

			await increaseTimeTo(this.beforeClosingTime);

			await this.crowdsale.send(investmentAmount);
			await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: purchaser });
			(await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);
		});

		it('should grant an extra 20% tokens as bonus for contributions first week', async function () {
			const investmentAmount = ether(1);
			const expectedTokenAmount = rate.mul(investmentAmount).mul(1.2);

			await increaseTimeTo(this.openingTime);

			await this.crowdsale.send(investmentAmount);
			await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: purchaser });
			(await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);
		});

		it('should grant an extra 10% tokens as bonus for contributions first week', async function () {
			const investmentAmount = ether(1);
			const expectedTokenAmount = rate.mul(investmentAmount).mul(1.1);

			await increaseTimeTo(this.secondWeek);

			await this.crowdsale.send(investmentAmount);
			await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: purchaser });
			(await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);
		});

		it('should grant an extra 32% tokens as bonus for contributions first week and 5 ETH', async function () {
			const investmentAmount = ether(5);
			const expectedTokenAmount = rate.mul(investmentAmount).mul(1.2).mul(1.1);

			await increaseTimeTo(this.openingTime);

			await this.crowdsale.send(investmentAmount);
			await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: purchaser });
			(await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);
		});

		it('should accept bonus changes only from owner', async function () {
		 const newTimeBonuses = [this.openingTime +  duration.weeks(1),110,    this.openingTime + duration.weeks(2),105,    0,100];
		 const newAmountBonuses = [ether(10*200),110,    ether(5*200),105,     ether(0),100];
		 await expectThrow(
		   this.crowdsale.changeBonuses(newTimeBonuses, newAmountBonuses, { value: 0, from: purchaser })
		   , EVMRevert);
		});

		it('should grant an extra 11.1% tokens as bonus for contributions first week and 5 ETH on new settings', async function () {
		  const investmentAmount = ether(5);
		  const expectedTokenAmount = rate.mul(investmentAmount).mul(1.1).mul(1.05);

		  const newTimeBonuses = [this.openingTime +  duration.weeks(1),110,    this.openingTime + duration.weeks(2),105,    0,100];
		  const newAmountBonuses = [ether(10*200),110,    ether(5*200),105,     ether(0),100];
		  await this.crowdsale.changeBonuses(newTimeBonuses, newAmountBonuses);

		  await increaseTimeTo(this.openingTime);

		  await this.crowdsale.send(investmentAmount);
		  await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: purchaser });
		  (await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);
		});


		it('should reflect deployment bonuses', async function () {
		  const investmentAmount = ether(10); // 1000 $
		  const expectedTokenAmount = rate.mul(investmentAmount).mul(1.3).mul(1.1);

			this.openTime = this.openingTime;

		  const newTimeBonuses = [
				this.openTime +  duration.days(45),130,
				this.openTime +  duration.days(65),125,
				this.openTime +  duration.days(85),120,
				this.openTime + duration.days(100),115,
				this.openTime + duration.days(115),110,
				this.openTime + duration.days(130),105,
				0,100];
		  const newAmountBonuses = [
				ether(50000),120,
				ether(25000),115,
				ether(500),110,
				ether(0),100];

		  await this.crowdsale.changeBonuses(newTimeBonuses, newAmountBonuses);

		  await increaseTimeTo(this.openingTime);

		  await this.crowdsale.send(investmentAmount);
		  await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: purchaser });
		  (await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);
		});


		it('should accept start/stop changes only from owner', async function () {
			await expectThrow(
			  this.crowdsale.changeOpeningClosingTime(this.newOpeningTime, this.closingTime, { value: 0, from: purchaser })
			  , EVMRevert);
		});

		it('should accept payments after start, new settings', async function () {
		  await increaseTimeTo(this.beforeOpeningTime);

		  // should reject payments before start
		  await expectThrow(this.crowdsale.send(value), EVMRevert);
		  await expectThrow(this.crowdsale.buyTokens(investor, { from: purchaser, value: value }), EVMRevert);

		  // should accept payments with new settings
		  await this.crowdsale.changeOpeningClosingTime(this.newOpeningTime, this.closingTime);
		  await this.crowdsale.send(value);
		  await this.crowdsale.buyTokens(investor, { value: value, from: purchaser });
		});

		it('should accept payments after new settings of closingTime', async function () {
		  await increaseTimeTo(this.afterClosingTime);

		  // should reject payments after closing time
		  await expectThrow(this.crowdsale.send(value), EVMRevert);
		  await expectThrow(this.crowdsale.buyTokens(investor, { from: purchaser, value: value }), EVMRevert);

		  // should accept payments with new settings
		  await this.crowdsale.changeOpeningClosingTime(this.openingTime, this.newClosingTime);
		  await this.crowdsale.send(value);
		  await this.crowdsale.buyTokens(investor, { value: value, from: purchaser });
		});

		it('should read and change rate', async function () {
		    const investmentAmount = ether(1);
		    const expectedTokenAmount = rate.mul(investmentAmount);

		    await increaseTimeTo(this.beforeClosingTime);

		    await this.crowdsale.send(investmentAmount);
		    await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: purchaser });
		    (await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);

				(await this.crowdsale.getCurrentRate(investmentAmount)).should.be.bignumber.equal(rate);


				const newRate = new BigNumber(400);
				await this.crowdsale.changeRate(newRate);
				(await this.crowdsale.getCurrentRate(investmentAmount)).should.be.bignumber.equal(rate * 2);

				const expectedTokenAmountSecond = newRate.mul(investmentAmount).plus(expectedTokenAmount);
				await this.crowdsale.send(investmentAmount);
		    await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: purchaser });
		    (await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmountSecond);

		  });

		it('should grant an extra 11.1% tokens as bonus for contributions first week and 5 ETH on new settings', async function () {
		    const investmentAmount = ether(5);
		    const expectedTokenAmount = rate.mul(investmentAmount).mul(1.1).mul(1.05);

		    const newTimeBonuses = [this.openingTime +  duration.weeks(1),110,    this.openingTime + duration.weeks(2),105,    0,100];
		    const newAmountBonuses = [ether(10*200),110,    ether(5*200),105,     ether(0),100];
		    await this.crowdsale.changeBonuses(newTimeBonuses, newAmountBonuses);

		    await increaseTimeTo(this.openingTime);

		    await this.crowdsale.send(investmentAmount);
		    await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: purchaser });
		    (await this.token.balanceOf(investor)).should.be.bignumber.equal(expectedTokenAmount);
		  });

		it('should be able transfer remaining token to owner and burn token after crowdsale ends', async function () {
		    const investmentAmount = ether(4);
		    const expectedTokenAmount = rate.mul(investmentAmount).mul(1);

		    await increaseTimeTo(this.beforeClosingTime);

		    // check initial amount of token
		    (await this.token.balanceOf(this.crowdsale.address)).should.be.bignumber.equal(contractSupply);

		    // transfer and check  amount of token is less
		    await this.crowdsale.send(investmentAmount);
		    await this.crowdsale.buyTokens(investor, { value: investmentAmount, from: purchaser });
		    (await this.token.balanceOf(investor)).should.be.bignumber.lessThan(contractSupply);

		    // reclaimtoken and check  amount of token is 0 in crowdsale, and bigger than before for owner
		    var ownerSupplyBefore = await this.token.balanceOf(this.owner);
		    await this.crowdsale.reclaimToken(this.token.address);
		    (await this.token.balanceOf(this.crowdsale.address)).should.be.bignumber.equal(0);
		    (await this.token.balanceOf(this.owner)).should.be.bignumber.greaterThan(ownerSupplyBefore);

				// burn token and check  amount of token is less than before for owner
				ownerSupplyBefore = await this.token.balanceOf(this.owner);
				var burnSupply = 1000*50**9;
				await this.token.burn(burnSupply);
				(await this.token.balanceOf(this.owner)).should.be.bignumber.lessThan(ownerSupplyBefore);

		    // await this.token.totalSupply().then(function(a){console.log('Total supply balance',a);});
		    // await this.token.balanceOf(this.crowdsale.address).then(function(a){console.log('Crowdsale balance',a);});
		  });

	});
});
